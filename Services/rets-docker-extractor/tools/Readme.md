# Import Metadata tool

- queries mongodb imports
- maps imports to a rets-client connection
- uses RetsClientService and RetsImporterService to perform metadata queries against RETS servers
- logs metadata to local files
- uploads found metadata and or errors to the imports-metadata collection 
- configures database based on config/

Options: see the importMetadataTool.js comments

> `NODE_ENV=test DEBUG=rets-client:* node tools/importMetadataTool.js --importid 577a61af7a40553ad5000004`

## Notes

- create a /logs directory

- set up your /config/test.yml
  - configure mongoConnection
  - OR pass --mongoconnection "mongodb://" ...

- use `rm -rf tools/logs/*` to clear log files

# Import Query Test tool

- queries mongodb imports
- maps imports to an ETL ExtractionRequest
- uses RetsClientService and RetsImporterService to perform listing queries against RETS servers
- logs listings to local files
- uses RetsExporterService with a fake S3 service to store extracted documents to the local file system
- configures databases based on config/

Options: see the importQueryTest.js comments

> `NODE_ENV=test node tools/importQueryTest.js --scheduleId RETS15 --take 1`

> `NODE_ENV=test node tools/importQueryTest.js --importId 4f4d0be6d23a545f33000bd3`
