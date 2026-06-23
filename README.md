 ## 1. Getting Started: Access & Account Setup
  ### Account Creation (Sign Up)
  1. Navigate to the web application URL.
  2. If you don't have an account yet, click "Sign Up" on the login page.
  3. Fill in your details:
      • Full Name (Use your professional name, as it will be shown on the Kanban board and Leaderboard).
      • Email Address
      • Password
  4. Submit the form to create your profile.

  ### Logging In

  1. Enter your registered email and password on the Login screen.
  2. Check the "Keep me logged in" option if you are on a trusted personal computer.
  3. Click Login to enter the dashboard.
  ──────
  ## 2. The Kanban Board & Columns

  The main interface is the Task Board, which organizes tasks into columns representing different operational phases.

  • Sierra Bravo (SB) · Standby: Backlog or queue. New tasks land here.
  • Oscar Mike (OM) · In Progress: Tasks currently active and being worked on.
  • India Romeo (IR) · In Review: Tasks ready for verification or approval.
  • Tango Charlie (TC) · Completed: Tasks successfully completed. Moving a task here awards points.
  • Oscar Delta (OD) · Daily Recurring: Special column for tasks that reset every day. These tasks do not move and
  are handled separately.

  │ Tip: Drag and drop tasks between columns to update their status. Tasks in the Oscar Delta (OD) column cannot be
  │ dragged, as they are daily habits.
  ──────
  ## 3. Creating & Managing Tasks

  ### How to Create a Task

  You can create a task in two ways:

  1. Global Button: Click "New Task" in the top-right header of the Board.
  2. Column-Specific Button: Click "+ Add task to [COL]" at the bottom of any column to instantly create a task pre-
  assigned to that column.

  ### Core Task Attributes

  When creating or editing a task, you must fill out the following properties:

  • Task Name & Description: Clear action items.
  • Owner: The team member responsible for finishing the task.
  • Due Date: The deadline. Crucial for scoring.
  • Priority (P1–P5): Indicates business urgency.
  • DECO Level: Indicates duration and technical complexity.
  • Labels: Classification tags (e.g., Revenue, Fundraise, Customer Delivery, Ops, Tech, Product). A task must have 1
  or 2 labels.
  ──────
  ## 4. Gamified Leaderboard & Scoring System

  SmartScore uses a gamified point system to reward speed, efficiency, and organization.

  ### Scoring Formula

    Score = Priority Weight × DECO Weight × 100 × Early Completion Bonus

  #### A. Priority Weights

  • P1 (Very Important):  0.5
  • P2 (Important):  0.4
  • P3 (Kind Of Important):  0.3
  • P4 (Not Important):  0.2
  • P5 (Least Important):  0.1

  #### B. DECO Weights (Complexity & Duration)

  • High (7+ Days):  0.5
  • Medium High (5 to 7 Days):  0.4
  • Medium (3 to 5 Days):  0.3
  • Medium Low (1 to 3 Days):  0.2
  • Low (Less than 1 Day):  0.1

  #### C. Early Completion Bonus

  The bonus multiplier is calculated based on how early you complete the task compared to its Due Date:

  • 10+ Days Early:  10  (Maximum cap)
  • X Days Early:  X  (e.g., 5 days early =  5  multiplier)
  • On the Due Date:  1
  • Late (After Due Date):  0  (Zero points are awarded)

  │ Warning: Late tasks score exactly  0  points. Make sure to communicate blockages or adjust scopes early to avoid
  │ missing deadlines! Oscar Delta (OD) daily recurring tasks do not award leaderboard points.
  ──────
  ### Score Visual Breakdown

  To view your score, click any task card. The Score Breakdown card displays:

  1. Status: Shows either your final score (if completed) or your projected score if you complete it today.
  2. Breakdown: Shows the exact weights of your Priority, DECO level, days early, and final bonus calculation.
  ──────
  ### The Leaderboard Page

  Visit the Leaderboard tab in the sidebar to track the team's performance.

  • Tabs: Filter scores by "This Week", "This Month", or "All Time".
  • Medals: Ranks 1, 2, and 3 are automatically highlighted with 🥇, 🥈, and 🥉.
  • Expandable Details: Click on any team member's row to expand and view the exact tasks that contributed to their
  score, along with completed dates and days early.
  • My Stats Card: Displays your all-time points, weekly rank, weekly completed tasks, and your best single task
  score ever.
  ──────
  ## 5. Automated Dependencies (V2 Feature)

  If your task cannot proceed without someone else's work, you can create a Dependency.

  ### Creating a Dependency

  1. Open the New Task sheet or edit an existing task.
  2. Under Dependencies, select the team member you are waiting on and write a reason (e.g., "Need database schema
  designed").
  3. Click Add Dependency.
  4. What happens automatically:
      • A linked dependency task is automatically created and assigned to that team member with the same priority,
      DECO weight, and due date.
      • Your task is automatically marked with a red Blocked badge showing the blocking reason.
      • The team member receives an immediate email alert notifying them that you are waiting on them.


  ### Resolving Dependencies

  1. Once the assigned team member completes the dependency task or you click "Mark dependency resolved" in the task
  sheet details, the dependency is cleared.
  2. Once all dependencies on a task are resolved, the Blocked badge automatically disappears, and you can proceed
  with your task.
  ──────
  ## 6. Daily Recurring Tasks (Oscar Delta)

  • Daily operations checklists reside in the Oscar Delta (OD) column.
  • Click any recurring task to see details.
  • Daily tasks are completed by ticking their checkboxes.
  • Automatic Reset: These tasks reset every day so they can be repeated.
