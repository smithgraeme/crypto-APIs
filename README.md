# CryptoAPIs

This project is a simple AWS serverless app that scrapes cryptocurrency price data and exposes an API to query it based on time range and coin.

Example call:

https://j8xyoalc6l.execute-api.us-east-2.amazonaws.com/dev/cryptoGetData_RDS?coinID=ripple&from=2018-06-21T22%3A38%3A36.890Z&to=2018-06-23T22%3A38%3A36.890Z&unixEpochTimestamp=true
