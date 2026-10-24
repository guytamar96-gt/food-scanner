# food-scanner

Live barcode scanner and food catalogue.

- **App:** https://guytamar96-gt.github.io/food-scanner/ (add it to your phone's home screen)
- **Catalogue:** [`foods.csv`](foods.csv), one row per food with nutrition values per 100 g. Every food you scan or add in the app is saved here.

Lookups go to the catalogue first, then [Open Food Facts](https://world.openfoodfacts.org). Foods that neither knows are typed in once from the label.

Saving to `foods.csv` from the phone needs a fine-grained GitHub token limited to this repository (Contents: read and write), entered once in the app's Settings tab. The token stays on the phone.

Barcode decoding falls back to [ZXing](https://github.com/zxing-js/library) (Apache 2.0, in `vendor/`) where the browser has no built-in barcode reader.
