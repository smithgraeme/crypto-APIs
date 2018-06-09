const mysqlPromise = require('mysqlPromise');
const mysql = require('mysql')

var db, awsCallback

exports.handler = async(event, context, callback) => {
    setup(context, callback)

    const params = event.queryStringParameters

    if (params && params.coinID && params.from && params.to) {
        console.log("Params: " + JSON.stringify(params, null, 2))

        const days = getTimestampRangeInDays(params.from, params.to)

        const query = `select priceUSD,timestamp,coinIdentifier from coinPrices WHERE coinIdentifier = ? and timestamp > ? and timestamp < ? ORDER BY timestamp`
        const args = [params.coinID, params.from, params.to]

        var response = await db.query(query, args)
        db.close()

        console.log("Datapoints: " + response.length)

        //trim down results to roughly some upper bound count
        //of results spread across the range of results
        //this is only a ROUGH upper bound to start doing trimming, the actual count will be lengthCutoff <=actual count <= 2*lengthCutoff
        //this is ok since this is all just for query performance so it doesn't need to be exact

        const lengthCutoff = 10;
        if (response.length > lengthCutoff) {
            response = trimResponse(response, lengthCutoff)
        }

        returnResponse(response)
    }
    else {

    }
};

function trimResponse(response, lengthCutoff) {
    const sizeFactor = Math.floor(response.length / lengthCutoff)

    console.log("Trimming results with sizeFactor: " + sizeFactor)

    const trimmedResponse = []

    for (var i = 0; i < response.length - 1; i = i + sizeFactor) {
        trimmedResponse.push(response[i]);
    }

    //always include the last element, so we cover the full timestamp range
    //from the request as well as possible and only trim out values from the middle
    trimmedResponse.push(response.slice(-1)[0]);

    console.log("Datapoints (trimmed): " + trimmedResponse.length)
    return trimmedResponse
}

function getTimestampRangeInDays(fromInput, toInput) {
    const from = new Date(fromInput);
    console.log("From: " + from)

    const to = new Date(toInput);
    console.log("To: " + to)

    const diffMilliseconds = to.getTime() - from.getTime()

    const diffDays = diffMilliseconds / (1000 * 60 * 60 * 24);
    console.log("Time range in days: "+diffDays)
    return diffDays
}

function returnResponse(response) {
    awsCallback(null, {
        statusCode: 200,
        body: JSON.stringify(response, null, 2),
    })
}

function setup(context, callback) {
    context.callbackWaitsForEmptyEventLoop = true;
    awsCallback = callback

    db = new mysqlPromise({
        host: process.env.host,
        user: process.env.username,
        password: process.env.password,
        database: "cryptocurrency",
    });
}
