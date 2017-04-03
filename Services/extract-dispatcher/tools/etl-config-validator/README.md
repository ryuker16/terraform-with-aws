# etl-config-validator

This is a tool which takes an import id and creates the extraction request. The main goal is to validate the transform manifest that is created from our legacy import documents.

`npm run sync` will sync the config/* files from S3

NODE_ENV wll be used to specify the config

## How to run

First, create the output directory for the files. index.js writes to a 'data' directory.

The index.js will take one or more import ids to create extraction requests for. Run with the following command:
node index.js 123456 78910

It will output a file in the data directory for each import, a sample filename would be:
/data/123456_extract_request.json