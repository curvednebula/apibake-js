# ApiBake

Convert OpenAPI spec to PDF. Supports OpenAPI 3.0.0+ json and yaml.

**Quick start:**

```
npm install -g apibake

apibake <openapi.json|.yaml|folder-name> [<file-or-folder2> <file-or-folder3> ...] [<options>]
```

**Options:**

```
 --out <string>: Output PDF file name.
 --title <string>: Document title.
 --subtitle <string>: Document sub title.
 --separate-schemas: When multiple API files parsed, create separate schemas section for each.
 --config <string>: Path to apibake-config.json. See --export-config.
 --export-config: Save default config into json file for editing.
 -h: Show this help.
```

**Examples:**

Specify title and subtitle for your PDF:

```
apibake openapi.json --title 'REST API Spec' --subtitle 'created with ApiBake'
```

Combine several OpenAPI specs into one PDF:

```
apibake api1.json api2.yaml --title 'REST API Spec'
apibake dir/with/openapi-specs --title 'REST API Spec'
```

# Custom config: fonts, colors, page margins.

To modify default apibake config - first export it into a file:

```
apibake --export-config
```

Modify apibake-config.json and tell apibake to use it:

```
apibake openapi.json --config apibake-config.json
```

Colors specified in #RRGGBB format.

PDF default fonts can be specified by their names:

 - Courier
 - Courier-Bold
 - Courier-Oblique
 - Courier-BoldOblique
 - Helvetica
 - Helvetica-Bold
 - Helvetica-Oblique
 - Helvetica-BoldOblique
 - Symbol
 - Times-Roman
 - Times-Bold
 - Times-Italic
 - Times-BoldItalic
 - ZapfDingbats

Alternatively, external font files can be specified. Supported font formats: TrueType (.ttf), OpenType (.otf), WOFF, WOFF2, TrueType Collection (.ttc), and Datafork TrueType (.dfont) fonts.

Example:

```
  "font": {
    "baseSize": 10,
    "main": {
      "norm": {
        "face": "fonts/Roboto-Regular.ttf"
      },
      "bold": {
        "face": "fonts/Roboto-Bold.ttf"
      },
      "italic": {
        "face": "fonts/Roboto-Italic.ttf"
      }
    },
    "mono": {
      "norm": {
        "face": "Courier"
      },
      "bold": {
        "face": "Courier-Bold"
      },
      "italic": {
        "face": "Courier-Oblique"
      }
    }
  }
```

Note: if font file is a collection of fonts (.ttc) font style must be specified:

```
 "font": {
    "main": {
      "norm": {
        "face": "fonts/Roboto.ttc",
        "style": "Roboto-Regular"
      },
      "bold": {
        "face": "fonts/Roboto.ttc",
        "style": "Roboto-Bold"
      },
    },
    ...
 }
```



# MIT License

Copyright (c) 2023 CurvedNebula.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
