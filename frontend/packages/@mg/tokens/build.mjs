import StyleDictionary from 'style-dictionary';

// Uma fonte (tokens.json) -> vários formatos. Nunca dessincroniza.
const sd = new StyleDictionary({
  source: ['tokens.json'],
  platforms: {
    // 1) CSS custom properties -> consumido por CSS puro / CSS Modules
    css: {
      transformGroup: 'css',
      prefix: 'mg',
      buildPath: 'build/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: { outputReferences: true }
        }
      ]
    },
    // 2) Objeto JS/TS -> consumido por Vanilla Extract, JS, etc.
    js: {
      transformGroup: 'js',
      prefix: 'mg',
      buildPath: 'build/',
      files: [
        {
          destination: 'tokens.js',
          format: 'javascript/es6'
        }
      ]
    }
  }
});

await sd.buildAllPlatforms();
console.log('tokens gerados em build/');
