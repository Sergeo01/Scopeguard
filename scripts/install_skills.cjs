const fs = require('fs');
const path = require('path');

const globalSkills = 'C:\\Users\\ROG ZEPHYRUS\\.gemini\\config\\skills';
const projectSkills = 'd:\\Hackathon\\NEAR\\.agent\\skills';

const skillsToCopy = [
  {
    name: 'hallmark',
    src: 'd:\\Hackathon\\NEAR\\temp_hallmark\\skills\\hallmark'
  },
  {
    name: 'ui-ux-pro-max',
    src: 'd:\\Hackathon\\NEAR\\temp_ui_ux\\.claude\\skills\\ui-ux-pro-max'
  },
  {
    name: 'taste-skill',
    src: 'd:\\Hackathon\\NEAR\\temp_taste\\skills\\taste-skill'
  },
  {
    name: 'web-design-guidelines',
    src: 'd:\\Hackathon\\NEAR\\temp_vercel\\skills\\web-design-guidelines'
  }
];

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  for (const element of fs.readdirSync(from)) {
    const srcPath = path.join(from, element);
    const destPath = path.join(to, element);
    const stat = fs.lstatSync(srcPath);
    if (stat.isDirectory()) {
      copyFolderSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

for (const skill of skillsToCopy) {
  console.log(`Installing ${skill.name}...`);
  const globalDest = path.join(globalSkills, skill.name);
  const projectDest = path.join(projectSkills, skill.name);

  copyFolderSync(skill.src, globalDest);
  copyFolderSync(skill.src, projectDest);

  const globalSkillFile = path.join(globalDest, 'SKILL.md');
  const projectSkillFile = path.join(projectDest, 'SKILL.md');

  console.log(`  -> Global SKILL.md exists: ${fs.existsSync(globalSkillFile)}`);
  console.log(`  -> Project SKILL.md exists: ${fs.existsSync(projectSkillFile)}`);
}

console.log('Finished installing all skills.');
