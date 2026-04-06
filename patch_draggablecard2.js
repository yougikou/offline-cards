const fs = require('fs');
const path = 'src/components/DraggableCard.tsx';
let code = fs.readFileSync(path, 'utf8');

// Update selectAnim interpolate range from [0, -15] to [0, -10]
code = code.replace(/\{ translateY: selectAnim.interpolate\(\{ inputRange: \[0, 1\], outputRange: \[0, -15\] \}\) \}/g, '{ translateY: selectAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }');

// Update borderStyle color from #FFD700 to #A0A0A0
code = code.replace(/const borderStyle = isSelected \? \{ borderColor: '#FFD700', borderWidth: 2 \} : \{ borderColor: '#E0E0E0', borderWidth: 1 \};/g, "const borderStyle = isSelected ? { borderColor: '#A0A0A0', borderWidth: 2 } : { borderColor: '#E0E0E0', borderWidth: 1 };");

fs.writeFileSync(path, code);
