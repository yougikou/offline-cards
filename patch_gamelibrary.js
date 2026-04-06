const fs = require('fs');
const path = 'src/components/home/GameLibrary.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace ScrollView with View
code = code.replace(/<ScrollView ref=\{scrollViewRef\} horizontal showsHorizontalScrollIndicator=\{false\} style=\{\{ marginHorizontal: -20 \}\} contentContainerStyle=\{styles\.gameCarousel\}>/g, '<View style={styles.gameCarousel}>');
code = code.replace(/<\/ScrollView>/g, '</View>');

// Remove ScrollView import if unused
code = code.replace(/, ScrollView /, ' ');

// Update styles
code = code.replace(/gameCarousel: \{\s*paddingBottom: 10,\s*paddingHorizontal: 20,\s*gap: 15,\s*\}/g, `gameCarousel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 15,
    paddingBottom: 10,
    paddingHorizontal: 5,
  }`);

code = code.replace(/gameCard: \{([\s\S]*?)marginRight: 15,/g, 'gameCard: {$1');
fs.writeFileSync(path, code);
