# Easter Egg Hunt Game

A simple HTML5 Easter egg hunt game built with PixiJS.

## Play the Game

The game is hosted on GitHub Pages at: [Your GitHub Pages URL]

## Development

### Prerequisites

- Node.js
- npm

### Setup

1. Clone the repository:
```
git clone https://github.com/your-username/simple-html5-pokemon-game.git
cd simple-html5-pokemon-game
```

2. Install dependencies:
```
npm install
```

3. Start the development server:
```
npm run serve
```

### Building for Production

To build the game for production (and GitHub Pages):

```
npm run deploy
```

This will create a `dist` folder with the built application.

## Deploying to GitHub Pages

1. Build the project:
```
npm run deploy
```

2. Push the dist folder to the gh-pages branch:
```
git add dist -f
git commit -m "Deploy to GitHub Pages"
git subtree push --prefix dist origin gh-pages
```

Or use the GitHub Actions workflow to deploy automatically.

## License

ISC
