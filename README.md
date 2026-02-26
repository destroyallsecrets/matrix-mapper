
# Sight_OS / Matrix Spatial Mapper

**Sight_OS** is a high-fidelity cyberpunk visualizer that transforms your camera feed into a "true vision" Matrix simulation. It renders reality as a stream of binary data, reacting to motion, light, and sound in real-time. It includes tactical AI analysis capabilities powered by Google Gemini.

## Core Features

### 1. Visual Reality Mapping
The application does not simply overlay effects; it reconstructs the camera feed using a custom character-based lighting model.
*   **Terminal Mode (Default):** Simulates a night-vision substrate where the structure of the room is visible as dim green '0's. Active motion or bright light sources trigger intense '1' streams that burn white-hot.
*   **AR Sight Mode (Natural):** A cinematic "Bleach Bypass" color grading mode that retains the binary structure but restores desaturated colors, providing a gritty, realistic augmented reality view.

### 2. Vertical Vision Stream
A constant vertical flow of data ("Digital Rain") scans the environment.
*   **Void Interaction:** In dark areas, faint rain falls to provide depth.
*   **Object Interaction:** When rain passes over physical objects, it interacts with the luma values, creating a "Vision Mapping" effect where the code highlights the contours of reality.

### 3. Tactical AI Analysis
*   **Audit Function:** Click the `Audit` button to capture a snapshot of the current matrix stream. This is sent to the Gemini 3 Flash model, acting as a tactical AI to analyze objects, threats, or structural details in the frame.
*   **System Logs:** A scrolling terminal output displays the AI's analysis and system events.

### 4. Audio-Visual Integration
The simulation visualizes spatial data using 3D wireframes and Matrix-style code streams, creating a synesthetic connection between visual data and the environment.

## User Interface & Controls

### Main Header
*   **Audit (Scan Icon):** Triggers the AI analysis.
*   **Popout (External Link Icon):** Detaches the vision layer into a Picture-in-Picture window, allowing the matrix rain to float over your other desktop applications.
*   **Broadcast (Cast Icon):** Enters a distraction-free fullscreen mode, removing all UI elements for pure visualization.
*   **Settings (Gear Icon):** Opens the side parameter menu.

### Parameter Menu (Side Panel)
*   **Optic Input:** Select which camera device to use (supports front/back cameras).
*   **Stream Persistence:** Controls how quickly the motion trails decay.
    *   *0%*: Instant decay (Real-time movement).
    *   *100%*: Long exposure trails (Light painting).
*   **AR Sight Mode:** Toggles between the green terminal view and the cinematic color view.
*   **Logic Logs:** Toggles the visibility of the system terminal panel.

### System Logs
*   Displays real-time logs of system status and AI analysis results.
*   **Close Button (X):** Hides the log panel to maximize the visualizer area.

## Technical Implementation

### Rendering Engine (`RealityMapper.tsx`)
*   **Canvas API:** Uses a high-performance 2D canvas context.
*   **Optimized Buffers:** Uses `Float32Array` for energy grids and luma storage to ensure 60fps performance even on mobile devices.
*   **Lighting Model:** Implements a custom shader-like logic in JavaScript to handle bloom, exposure, and color mixing based on pixel luminance and motion deltas.

### PiP (Picture-in-Picture)
*   Uses `canvas.captureStream()` to generate a MediaStream from the rendering canvas.
*   Feeds this stream into a hidden `<video>` element to leverage the browser's Picture-in-Picture API.

## Requirements
*   **Camera & Microphone Permissions:** Essential for the visualization to function.
*   **Google Gemini API Key:** Required for the `Audit` feature to perform text generation.

---
*Built with React, TypeScript, and the Gemini API.*
