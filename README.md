world-fun 🌍🎮
world-fun is an exciting virtual world project where AI agents and human players can interact, chat, and socialize in a variety of immersive environments. This project uses Convex as the backend data management engine, while PixiJS and React are used to build a real-time, dynamic client interface. Players and agents alike can explore, customize, and expand these worlds, with built-in map editing tools to shape the virtual landscapes. 🌟

Key Features ✨
Real-time Multiplayer Interaction
Players can join and leave different virtual worlds, navigate the maps, and engage in conversations with other players or AI agents. The game state updates with a high-frequency tick model, ensuring smooth animations and real-time interactions. ⚡

AI Agents and Freedom of Play
The project features built-in AI agents capable of mimicking human behavior through rules and interactions with large language models (LLMs). These agents can start conversations, remember dialogues, and perform various asynchronous tasks, creating a rich social environment. 🤖💬

Server-Side Game Logic
All game logic runs on the Convex backend, which handles input processing, state updates, and historical data tracking. To avoid concurrency issues, the system ensures that each world state is updated in a single-threaded manner. 🔧

Map Editor
The built-in level editor, located in the src/editor directory, allows users to customize maps through a graphical interface. Users can configure non-collidable background layers and collidable object layers, enabling them to create unique game environments. 🗺️✏️

Layered Architecture

Server Logic (convex/aiTown): Manages world state, player/agent data, dialogues, and history.
Game Engine (convex/engine): Handles time simulation, state persistence, and input processing.
AI Agents (convex/agent): Defines agent behavior, memory storage, and dialogue strategies.
Client UI (src/): Renders game states, history animations, and player interactions with PixiJS and React.

Architecture Overview 🏗️
The project follows a layered architecture with the following components:

Server-Side Game Logic (convex/aiTown)
Handles player and agent inputs, manages the world state, and updates data in real-time using Convex's query and mutation interfaces. 🖥️

Game Engine (convex/engine)
Smooth animations are achieved through high-frequency ticks, which update the game state, batch input processing, and store historical data for smooth playback. 🔄

AI Agents & Dialogue System (convex/agent)
AI agents interact with players through rules and LLM integration, summarizing conversations, remembering past interactions, and shaping their personalities. 🤖💭

Client UI (src/)
Built with pixi-react and React, this module renders the game state, historical animations, and user interface for real-time player interaction. 🌈

Map Editing & Level Design (src/editor)
Features a graphical editor with shortcut keys for map design, including importing/exporting map composite files and creating custom collision layers. 🌍🎨

How to Run 🚀
Prerequisites
Node.js (LTS version recommended)
npm or yarn
Install Dependencies
In the project root directory, run:

bash
npm install
or with yarn:

bash
yarn
Start Development Environment
This project uses a parallel development setup for both backend and frontend. You can start them separately:

Start Backend (Convex Backend and Function Emulator)
Run the following in the terminal:

bash
npm run dev:backend
This command starts the Convex development server and tracks backend logs.

Start Frontend (Client UI)
In another terminal, run:

bash
npm run dev:fe
Or, you can start both frontend and backend simultaneously with:

bash
npm run dev
The frontend will be available at http://localhost:3000 (or another configured port). 🌐

Map Editor
The built-in map editor can be started with:

bash
npm run le
This command will launch the map editor, typically available at localhost:5174. Use it to:

Import map composite files (JavaScript format)
Modify the background and object layers
Generate conversion files to import into the Convex database 🌟
Initialize World
After setting up the Convex development environment, initialize the default world by running:

bash
npx convex run init
This will load the initial map data and start the game engine. 🌍

Deployment Guide 🚀
Build the Code
Run the following command to compile the project:

bash
npm run build
This builds the TypeScript code and generates the frontend static assets. ⚡

Deploy Backend
Deploy the Convex backend to your target environment, ensuring the database, scheduler, and function services are properly configured. 🔧

Deploy Frontend
Deploy the generated frontend static files to a CDN or static hosting service (e.g., Vercel, Netlify). 🌍

Run Initialization Script
After deployment, run the initialization script to ensure the default world and associated data are created. 🚀

Directory Structure 📁
convex/
Contains server-side core logic, including:

Game logic (aiTown)
Game engine (engine)
AI agents and dialogue (agent)
Data models and input processing
src/
Client-side code, including:

UI components and main entry (main.tsx)
Map editor (editor/)
data/
Stores character data, map data, and resource configurations

Other files and configurations:

package.json: Project dependencies and scripts
.env: Environment variable configurations
ARCHITECTURE.md: Detailed architecture documentation
Contributing 🎉
We welcome contributions to world-fun! If you have suggestions, discover bugs, or want to add new features, follow these steps:

Fork the project and create your branch.
Submit your code, ensuring it passes relevant tests.
Open a Pull Request, and we'll review it as soon as possible.
Feel free to submit issues for bug reports or feature requests. 💬

License 📝
This project is licensed under the MIT License. Please refer to the LICENSE file for more details. 📃

Contact 💌
For any questions or suggestions, please submit an issue on GitHub or email the project maintainers. We're here to help!

Happy coding and enjoy your virtual adventures! 🎮🌟