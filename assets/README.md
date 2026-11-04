# Geographic sources

- Earth texture: NASA Blue Marble, distributed by [turban/webgl-earth](https://github.com/turban/webgl-earth/blob/master/images/2_no_clouds_4k.jpg). Original NASA collection: https://visibleearth.nasa.gov/collection/1484/blue-marble . Static composite, not live or street-level imagery. NASA imagery use: https://www.nasa.gov/nasa-brand-center/images-and-media/ .
- Boundaries: [Natural Earth 1:110m Admin 0 countries](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson), public domain: https://www.naturalearthdata.com/about/terms-of-use/ . These generalized geographic boundaries do not constitute a statement on sovereignty.
- Building coordinates: approximate WGS84 positions curated for this educational collection in `locations.js`; not navigation or survey data.

The single HTML build embeds all geographic assets. The global texture uses a simple equirectangular projection; zoom enlarges its fixed resolution rather than loading detailed map tiles. Nearby buildings are grouped by screen distance and individually selectable in the popover.
