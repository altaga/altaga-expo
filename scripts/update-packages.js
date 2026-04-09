const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MIN_AGE_DAYS = 7;
const MILLISECONDS_IN_A_DAY = 1000 * 60 * 60 * 24;
const packageJsonPath = path.join(__dirname, '../package.json');

async function fetchPackageInfo(pkgName) {
  return new Promise((resolve, reject) => {
    https.get(`https://registry.npmjs.org/${pkgName}`, (res) => {
      if (res.statusCode !== 200) {
        // e.g. private package or not found
        resolve(null);
        return;
      }
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

function getEligibleVersion(pkgInfo, pkgName) {
  if (!pkgInfo || !pkgInfo.versions || !pkgInfo.time) return null;
  const now = Date.now();
  
  // Get all valid versions (ignoring 'created', 'modified')
  const versions = Object.keys(pkgInfo.time).filter(v => v !== 'created' && v !== 'modified');
  
  // Sort versions by publish date (newest first)
  versions.sort((a, b) => new Date(pkgInfo.time[b]) - new Date(pkgInfo.time[a]));

  for (const version of versions) {
    if (pkgInfo.versions[version] && !pkgInfo.versions[version].deprecated) {
      // Check if it's a stable release (no alpha/beta/rc tags)
      if (version.includes('-')) continue;

      // Always return the latest stable version for the 'expo' framework specifically
      if (pkgName === 'expo') {
          return version;
      }

      const publishTime = new Date(pkgInfo.time[version]).getTime();
      const ageDays = (now - publishTime) / MILLISECONDS_IN_A_DAY;
      
      if (ageDays >= MIN_AGE_DAYS) {
        return version;
      }
    }
  }
  return null;
}

function removeModifiers(depObject) {
  if (!depObject) return;
  for (const pkg in depObject) {
    if (depObject[pkg].startsWith('^') || depObject[pkg].startsWith('~')) {
      depObject[pkg] = depObject[pkg].substring(1);
    }
  }
}

async function main() {
  console.log('Reading package.json...');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  const groupsToUpdate = ['dependencies', 'devDependencies'];
  let updatedAny = false;

  for (const group of groupsToUpdate) {
    if (!packageJson[group]) continue;
    
    for (const pkgName of Object.keys(packageJson[group])) {
      const currentVersion = packageJson[group][pkgName];
      console.log(`Checking ${pkgName} (current: ${currentVersion})...`);
      
      const info = await fetchPackageInfo(pkgName);
      const eligibleVersion = getEligibleVersion(info, pkgName);
      
      if (eligibleVersion) {
        // Strip any current modifiers to compare raw version
        const currentRaw = currentVersion.replace(/^[\^~]/, '');
        if (currentRaw !== eligibleVersion) {
          console.log(`  -> Update available: ${eligibleVersion} (meets ${MIN_AGE_DAYS} day age req)`);
          // Pin exact version
          packageJson[group][pkgName] = eligibleVersion;
          updatedAny = true;
        } else {
          // Just pin if it had modifier
          if (currentVersion !== currentRaw) {
             console.log(`  -> Pinning to exact version: ${currentRaw}`);
             packageJson[group][pkgName] = currentRaw;
             updatedAny = true;
          } else {
             console.log(`  -> Up to date and pinned.`);
          }
        }
      } else {
        console.log(`  -> Could not determine eligible version. Pinning current.`);
        const currentRaw = currentVersion.replace(/^[\^~]/, '');
        if (currentVersion !== currentRaw) {
           packageJson[group][pkgName] = currentRaw;
           updatedAny = true;
        }
      }
    }
  }

  if (updatedAny) {
    console.log('Writing updated explicitly pinned versions to package.json...');
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    
    console.log('Running npm install...');
    execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });

    console.log('Aligning Expo dependencies...');
    execSync('npx expo install --fix -- --legacy-peer-deps', { stdio: 'inherit' });

    console.log('Stripping modifier range chars added by Expo (--fix)...');
    const finalPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    removeModifiers(finalPackageJson.dependencies);
    removeModifiers(finalPackageJson.devDependencies);
    fs.writeFileSync(packageJsonPath, JSON.stringify(finalPackageJson, null, 2) + '\n');
    
    console.log('Running final npm install to apply lockfile changes...');
    execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
    
    console.log('Package updates applied and strictly pinned successfully!');
  } else {
    console.log('No updates required.');
  }
}

main().catch(err => {
  console.error('Error during update script:', err);
  process.exit(1);
});
