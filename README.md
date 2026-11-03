# food-scanner

Live barcode scanner and food catalogue.

- **App:** https://guytamar96-gt.github.io/food-scanner/ (add it to your phone's home screen)
- **Catalogue:** [`foods.csv`](foods.csv), one row per food with nutrition values per 100 g. Every food you scan or add in the app is saved here.

Lookups go to the catalogue first, then [Open Food Facts](https://world.openfoodfacts.org). Foods that neither knows are typed in once from the label.

Saving to `foods.csv` from the phone needs a fine-grained GitHub token limited to this repository (Contents: read and write), entered once in the app's Settings tab. The token stays on the phone.

Barcode decoding falls back to [ZXing](https://github.com/zxing-js/library) (Apache 2.0, in `vendor/`) where the browser has no built-in barcode reader.

## Credits

The muscle map body outlines come from [MuscleMap](https://github.com/melihcolpan/MuscleMap) by Melih Colpan, used under the MIT License:

> Copyright (c) 2026 Melih Colpan
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
