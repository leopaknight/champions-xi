# Vídeo de apresentação

Gera o vídeo institucional gravando o próprio app quadro a quadro (relógio controlado),
com legendas, cursor e destaques desenhados por cima (`studio.html`).

```bash
cp ../dist/fazenda-cafe-3d.html app.html && cp ../assets/logo.webp .
mkdir -p clips
for s in abertura inicio mapa os agenda maquinas campo solo pragas irrigacao colheita regioes final valor; do OUT=fr_$s node run.js $s; done
./montar.sh   # gera NexoCafe3D-apresentacao-1080p.mp4 e -720p.mp4
```

O roteiro e as legendas ficam em `scenes.js`. Sem GPU, cada quadro com 3D leva ~1–2 s.
