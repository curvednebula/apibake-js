# ApiBake

Convert OpenAPI spec to PDF. Supports OpenAPI 3.0.0+ json and yaml.

**Quick start:**

```
npm install -g apibake

apibake <openapi.json|.yaml|folder-name> [<file-or-folder2> <file-or-folder3> ...] [<options>]
```

**Options:**

```
 -out <string>: Output PDF file name.
 -title <string>: Document title.
 -subtitle <string>: Document sub title.
 -separate-schemas: When multiple API files parsed, create separate schemas section for each.
 -style <string>: Style to use. See -export-style.
 -export-style: Save document style into style.json for editing.
 -h: Show this help.
```

**Examples:**

Specify title and subtitle for your PDF:

```
apibake openapi.json -title 'REST API Spec' -subtitle 'created by ApiBake'
```

Combine several OpenAPI specs into one PDF:

```
apibake api1.json api2.yaml -title 'REST API Spec'
```



# MIT License

Copyright (c) 2022 CurvedNebula.com

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
