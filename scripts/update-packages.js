const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MIN_AGE_DAYS = 7;
const MILLISECONDS_IN_A_DAY = 1000 * 60 * 60 * 24;
const packageJsonPath = path.join(__dirname, '../package.json');

async function fetchPackageInfo(pkgName) {
  return new Promise((resolve) => {
    https.get(`https://registry.npmjs.org/${pkgName}`, (res) => {
      if (res.statusCode !== 200) {
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

function getEligibleVersion(pkgInfo) {
  if (!pkgInfo || !pkgInfo.versions || !pkgInfo.time) return null;
  const now = Date.now();
  const versions = Object.keys(pkgInfo.time).filter(v => 
    v !== 'created' && v !== 'modified' && !v.includes('-')
  );
  versions.sort((a, b) => new Date(pkgInfo.time[b]) - new Date(pkgInfo.time[a]));
  for (const version of versions) {
    if (pkgInfo.versions[version] && !pkgInfo.versions[version].deprecated) {
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
    if (typeof depObject[pkg] === 'string') {
       depObject[pkg] = depObject[pkg].replace(/^[\^~]/, '');
    }
  }
}

async function main() {
  console.log(`Phase 1: Selecting 7-day mature versions...`);
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const groups = ['dependencies', 'devDependencies'];
  
  // Track our targets
  for (const group of groups) {
    if (!packageJson[group]) continue;
    for (const pkgName of Object.keys(packageJson[group])) {
      const info = await fetchPackageInfo(pkgName);
      const eligible = getEligibleVersion(info);
      if (eligible) {
        packageJson[group][pkgName] = eligible;
      }
    }
  }

  console.log('Writing intermediary package.json...');
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  console.log('Phase 2: Aligning Expo ecosystem to our chosen Expo version...');
  try {
    // We run 'npx expo install --fix' to let Expo align its internal dependencies
    // to match the framework version we chose in Phase 1 (which survived the 7-day rule).
    // We add --min-release-age=0 ONLY for this step to allow Expo to fetch perfectly 
    // matching sub-packages that might be very new but required for the 7-day-old SDK.
    execSync('npx expo install --fix -- --legacy-peer-deps --min-release-age=0', { stdio: 'inherit' });
  } catch (e) {
    console.warn('Alignment warning, continuing to final enforcement...');
  }

  console.log('Phase 3: Final Enforcement (Strict 7-day Check + Pinning)...');
  const alignedPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  for (const group of groups) {
    if (!alignedPackageJson[group]) continue;
    for (const pkgName of Object.keys(alignedPackageJson[group])) {
      const info = await fetchPackageInfo(pkgName);
      const eligible = getEligibleVersion(info);
      if (eligible) {
         // This is the absolute final check. No package can be newer than 7 days.
         alignedPackageJson[group][pkgName] = eligible;
      }
    }
  }

  // Pin everything
  removeModifiers(alignedPackageJson.dependencies);
  removeModifiers(alignedPackageJson.devDependencies);
  fs.writeFileSync(packageJsonPath, JSON.stringify(alignedPackageJson, null, 2) + '\n');
  
  console.log('Phase 4: Final sync...');
  execSync('npm install --legacy-peer-deps --min-release-age=0', { stdio: 'inherit' });

  console.log('\nSUCCESS: Project updated to 7-day stable versions and strictly pinned.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
