🤖 AI Inventory & Order Agent
<p align="center">
<strong>An AI agent team that turns surplus stock into sales and prevents empty shelves.</strong>
</p>

<p align="center">
</p>

The Challenge
For any fast-paced business, inventory management is a constant struggle between understocking (lost sales) and overstocking (wasted money). This project replaces slow, manual inventory counts with an autonomous AI system that manages your stock for you.

✨ Core Features

Autonomous Monitoring: Uses a live camera feed to identify and count inventory in real-time.
Strategic Decision-Making: Intelligently decides whether to re-order items or create a promotion for surplus stock.
Automated Purchase Orders: Generates PDF purchase orders and drafts supplier emails when stock is low.
Creative Promotion Generation: Designs a complete marketing campaign—including an AI-generated image—to sell excess inventory.
Natural Language Control: Allows managers to modify orders with simple text commands (e.g., "add our standard drinks").

🤝 Meet the Agents

Our system's power comes from a team of specialized AI agents working together:
The Observer: Uses Gemini Pro Vision to watch the camera feed and provide an accurate, real-time inventory count.
The Brain: Analyzes the inventory data and decides on the best course of action: re-order or promote.
The Operator: Executes the re-order plan by creating purchase orders and preparing communications.
The Creative: Solves overstocking by designing a promotional campaign, complete with a unique, AI-generated marketing image.

🛠️ Tech Stack
Category	Technology
AI / LLM	Google Gemini Pro & Vision
Frontend	React, TypeScript, Tailwind CSS
Tooling	 Vite, jsPDF

🚀 Getting Started
Prerequisites: Node.js installed.
Clone the repository:
Generated bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git
cd YOUR_REPOSITORY_NAME

Install dependencies:
Generated bash
npm install
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END

Set up your Environment:
Create a .env.local file in the project root and add your API key:

Generated code
GEMINI_API_KEY=your_api_key_here
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

Run the app:
Generated bash
npm run dev
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END

Open your browser to the local URL provided and grant camera permissions to activate the agent.
