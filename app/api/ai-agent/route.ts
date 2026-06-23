// app/api/ai-agent/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { message, profiles, currentDate } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    const profilesList = (profiles ?? [])
      .map((p: any) => `- ${p.full_name} (ID: ${p.id}, Email: ${p.email})`)
      .join("\n");

    const systemPrompt = `You are a SmartScore AI task assistant. Your job is to parse a natural language task description in English and extract structured task attributes.
The current date (today) is: ${currentDate}.
Available profiles in the system to assign tasks to:
${profilesList}

Extract the following fields and return ONLY a valid JSON object. Do not return any extra description or text.

JSON Schema:
{
  "name": "string (the task summary/title)",
  "description": "string (details of the task if mentioned, otherwise empty string)",
  "ownerName": "string (the full_name of the profile that matched the owner/assignee, or empty if not matched)",
  "dueDate": "string (ISO YYYY-MM-DD format, resolved from relative descriptors like 'tomorrow', 'Friday', 'next week' relative to ${currentDate})",
  "priority": "P1" | "P2" | "P3" | "P4" | "P5" (Map: very important/urgent -> P1, important -> P2, kind of important -> P3, low/not important -> P4, least important -> P5. Default to P3 if unspecified)",
  "deco": "high" | "medium_high" | "medium" | "medium_low" | "low" (Map the complexity/duration: low/less than 1 day -> low, 1-3 days -> medium_low, 3-5 days -> medium, 5-7 days -> medium_high, >7 days/high -> high. Default to medium if unspecified)",
  "labels": ["string"] (array of 1-2 strings from: [revenue, fundraise, customer_delivery, ops, tech, product]. Select the most relevant based on context. Must select at least one, max two)
}`;

    // =========================================================================
    // OPTION 1: Google Gemini API (Free tier from aistudio.google.com)
    // =========================================================================
    if (geminiApiKey) {
      console.log("Processing task parsing using Google Gemini API...");
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `${systemPrompt}\n\nUser request to parse: "${message}"`
                  }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            }
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errText}`);
      }

      const resData = await response.json();
      const textContent = resData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      
      try {
        const parsedTask = JSON.parse(textContent);
        return NextResponse.json(parsedTask);
      } catch (parseErr) {
        console.error("Failed to parse JSON from Gemini response:", textContent);
        throw new Error("Gemini returned invalid JSON format");
      }
    }

    // =========================================================================
    // OPTION 2: Anthropic Claude API (Fallback if Claude Key is available)
    // =========================================================================
    if (anthropicApiKey) {
      console.log("Processing task parsing using Anthropic Claude API...");
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: "user", content: message }],
          temperature: 0,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      let textContent = data.content?.[0]?.text?.trim() || "";

      if (textContent.startsWith("```")) {
        textContent = textContent.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      }

      try {
        const parsedTask = JSON.parse(textContent);
        return NextResponse.json(parsedTask);
      } catch (parseErr) {
        console.error("Failed to parse JSON from Claude response:", textContent);
        throw new Error("Claude returned invalid JSON format");
      }
    }

    // =========================================================================
    // OPTION 3: Rule-Based Simulated Local Parser (Fallback if no API keys exist)
    // =========================================================================
    console.warn("No AI API keys configured. Running simulated rule-based parser fallback.");
    const lowercaseMsg = message.toLowerCase();
    
    // 1. Match ownerName to profiles
    let matchedOwner = "";
    if (profiles && profiles.length > 0) {
      for (const p of profiles) {
        const firstName = p.full_name.split(" ")[0].toLowerCase();
        const fullName = p.full_name.toLowerCase();
        if (lowercaseMsg.includes(fullName) || lowercaseMsg.includes(firstName)) {
          matchedOwner = p.full_name;
          break;
        }
      }
    }

    // 2. Resolve due date (defaults to tomorrow)
    let resolvedDate = currentDate;
    const today = new Date(currentDate);
    
    if (lowercaseMsg.includes("tomorrow")) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      resolvedDate = tomorrow.toISOString().split("T")[0];
    } else if (lowercaseMsg.includes("next week")) {
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      resolvedDate = nextWeek.toISOString().split("T")[0];
    } else if (lowercaseMsg.includes("friday")) {
      const resultDate = new Date(today);
      resultDate.setDate(today.getDate() + ((7 - today.getDay() + 5) % 7 || 7));
      resolvedDate = resultDate.toISOString().split("T")[0];
    } else {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      resolvedDate = tomorrow.toISOString().split("T")[0];
    }

    // 3. Resolve Priority
    let priority = "P3";
    if (lowercaseMsg.includes("very important") || lowercaseMsg.includes("p1") || lowercaseMsg.includes("urgent")) {
      priority = "P1";
    } else if (lowercaseMsg.includes("important") || lowercaseMsg.includes("p2")) {
      priority = "P2";
    } else if (lowercaseMsg.includes("least important") || lowercaseMsg.includes("p5")) {
      priority = "P5";
    } else if (lowercaseMsg.includes("low") || lowercaseMsg.includes("p4")) {
      priority = "P4";
    }

    // 4. Resolve DECO complexity
    let deco = "medium";
    if (lowercaseMsg.includes("low complexity") || lowercaseMsg.includes("1 day") || lowercaseMsg.includes("easy")) {
      deco = "low";
    } else if (lowercaseMsg.includes("medium low") || lowercaseMsg.includes("3 days")) {
      deco = "medium_low";
    } else if (lowercaseMsg.includes("high complexity") || lowercaseMsg.includes("10 days") || lowercaseMsg.includes("hard")) {
      deco = "high";
    }

    // 5. Resolve labels
    const availableLabels = ["revenue", "fundraise", "customer_delivery", "ops", "tech", "product"];
    const matchedLabels: string[] = [];
    for (const label of availableLabels) {
      if (lowercaseMsg.includes(label.replace("_", " "))) {
        matchedLabels.push(label);
      }
    }
    if (matchedLabels.length === 0) {
      matchedLabels.push("tech");
    }

    // 6. Clean task name
    let taskName = message;
    taskName = taskName.replace(/create a task for/i, "")
                       .replace(/remind/i, "")
                       .replace(/by next week/i, "")
                       .replace(/by tomorrow/i, "")
                       .replace(/by friday/i, "")
                       .trim();
    if (taskName.length > 50) {
      taskName = taskName.substring(0, 50) + "...";
    }

    const parsedResult = {
      name: taskName,
      description: `Parsed from plain text: "${message}" (Simulated fallback)`,
      ownerName: matchedOwner,
      dueDate: resolvedDate,
      priority,
      deco,
      labels: matchedLabels.slice(0, 2),
    };

    return NextResponse.json(parsedResult);

  } catch (error: any) {
    console.error("AI agent error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
