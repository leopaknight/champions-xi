const E = require('./engine'); const S = require('./scenes'); const { execSync } = require('child_process');
(async () => {
  const nome = process.argv[2];
  await E.init();
  try { await S[nome](E); } catch (e) { console.log('ERRO CENA', nome, e.stack); }
  await E.capOff(); await E.spotOff();
  await E.finish();
  execSync(`ffmpeg -y -loglevel error -f concat -safe 0 -i ${process.env.OUT}/list.txt -vf "fps=30,format=yuv420p" -c:v libx264 -preset medium -crf 18 clips/${nome}.mp4`);
  console.log('CLIPE', nome);
})();
