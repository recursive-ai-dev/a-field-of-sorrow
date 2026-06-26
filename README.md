# Ward of the Fallen Field

A battlefield rescue game where you save survivors using magical wards and healing spells.

## Description

"Ward of the Fallen Field" is a real-time strategy game built with React, TypeScript, and Three.js. As a mystical warder, you must navigate a battlefield at dusk, casting protective wards and healing spells to save wounded soldiers before encroaching darkness and enemy scouts claim them.

## Features

- **Real-time Gameplay**: Fast-paced action with dynamic day/night cycle
- **Magic System**: Cast protective wards and healing spells
- **Strategic Depth**: Manage cooldowns, morale, and limited time
- **3D Environment**: Beautiful battlefield with procedural terrain
- **Save/Load**: Save your progress and continue later
- **Accessible**: Keyboard navigation and screen reader support

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ward-of-the-fallen-field.git

# Navigate to the project directory
cd ward-of-the-fallen-field

# Install dependencies
npm install

# Start the development server
npm run dev
```

## Controls

- **WASD or Arrow Keys**: Move your character
- **Mouse Click**: Move to clicked location
- **Space**: Cast Protective Ward
- **E**: Cast Area Heal

## Game Mechanics

### Objective
Save as many survivors as possible before dusk falls. You win by rescuing at least 50% of the survivors or maintaining morale above 60%.

### Survivors
- Survivors slowly lose health over time
- Scouts accelerate health loss when nearby
- Protective wards shield survivors from damage
- Healing spells restore survivor health

### Morale System
- Each rescued survivor increases morale
- Each lost survivor decreases morale
- Higher morale improves your chances of victory

### Cooldowns
- Protective Ward: 6 second cooldown
- Area Heal: 4 second cooldown

## Technical Details

### Architecture
- **React + TypeScript**: Frontend framework
- **Three.js**: 3D rendering engine
- **Vite**: Build tool and development server
- **Tailwind CSS**: Utility-first CSS framework

### Performance Optimizations
- **Object Pooling**: Reuses ward objects to reduce garbage collection
- **Spatial Partitioning**: Efficient collision detection using spatial grids
- **Instanced Rendering**: Optimized rendering of debris and terrain
- **Custom Shaders**: Performance-optimized GLSL shaders

### Code Quality
- **Error Boundaries**: Graceful error handling
- **Input Validation**: Robust parameter checking
- **Resource Management**: Proper cleanup of Three.js objects
- **Type Safety**: Comprehensive TypeScript typing

## Development

### Project Structure

```
src/
├── components/      # React components
├── game/             # Game logic and 3D rendering
├── utils/            # Utility functions
├── App.tsx           # Main application component
├── main.tsx          # Entry point
└── index.css         # Global styles
```

### Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run preview`: Preview production build

### Dependencies

- **React 19**: Frontend library
- **Three.js**: 3D graphics
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool
- **Tailwind CSS**: CSS framework

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a pull request

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to the Three.js community for excellent documentation
- Inspired by classic rescue and strategy games
- Built with ❤️ for game development enthusiasts

## Contact

For questions or support, please open an issue on GitHub.
