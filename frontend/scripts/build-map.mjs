// Gera src/data/southern-africa.json a partir do Natural Earth (world-atlas).
// Rodar só se quiser mudar os países:  node scripts/build-map.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { feature } from 'topojson-client'

const topo = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/countries-50m.json', import.meta.url)))
const KEEP = {
  '710': 'África do Sul', '516': 'Namíbia', '072': 'Botsuana', '716': 'Zimbábue',
  '508': 'Moçambique', '426': 'Lesoto', '748': 'Essuatíni', '894': 'Zâmbia',
  '024': 'Angola', '454': 'Malawi', '450': 'Madagascar',
}
const round = (c) => (typeof c[0] === 'number' ? [+c[0].toFixed(2), +c[1].toFixed(2)] : c.map(round))
const all = feature(topo, topo.objects.countries).features
const features = all
  .filter((f) => KEEP[f.id])
  .map((f) => ({
    type: 'Feature',
    id: f.id,
    properties: { name: KEEP[f.id] },
    geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
  }))
writeFileSync(new URL('../src/data/southern-africa.json', import.meta.url), JSON.stringify({ type: 'FeatureCollection', features }))
console.log(features.map((f) => f.properties.name).join(', '))
