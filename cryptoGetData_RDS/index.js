const mysqlPromise = require('mysqlPromise');
const mysql = require('mysql')

var db, awsCallback

exports.handler = async(event, context, callback) => {
    setup(context, callback)

    const params = event.queryStringParameters

    if (params && params.coinID && params.from && params.to) {
        console.log("Params: " + JSON.stringify(params, null, 2))

        const days = getTimestampRangeInDays(params.from, params.to)
        //TODO: use this to day level summary info if querying over a large time range

        const query = `select priceUSD,timestamp,coinIdentifier from coinPrices WHERE coinIdentifier = ? and timestamp > ? and timestamp < ? ORDER BY timestamp`
        const args = [params.coinID, params.from, params.to]

        var response = await db.query(query, args)

        console.log("Datapoints from query: " + response.length)

        var datapointsCount = Math.round(params.datapoints)

        if (!(datapointsCount > 0 && datapointsCount < 2000)) {
            datapointsCount = process.env.dataPointsDefault;
        }

        if (response.length > datapointsCount) {
            response = trimResponse(response, datapointsCount)
        }

        returnResponse(response,params)
    }
    else {
        //no date range given
        //return either all the latest prices or the single latest price for the specified coin ID

        //see https://www.xaprb.com/blog/2006/12/07/how-to-select-the-firstleastmax-row-per-group-in-sql/ for some background on this query

        var query = `select c.priceUSD, c.timestamp, c.coinIdentifier
from (
   select coinIdentifier, max(timestamp) as maxtime
   from coinPrices group by coinIdentifier
) as x inner join coinPrices as c on c.coinIdentifier = x.coinIdentifier and c.timestamp = x.maxtime`;
        var args = []

        if (params && params.coinID) {
            query = query + " where c.coinIdentifier = ?"
            args = [params.coinID]
        }

        returnResponse(await db.query(query, args),params)
    }
};

//note on performance:
//yes, this trimming process is O(n^2) where n is the number of rows from the DB query
//and could I think be optimized but this is all just running in memory
//and is so much faster than the DB query itself it really doesn't matter
//This way keeps the functions more self containted and loosely coupled

function trimResponse(response, datapointsCount) {
    console.log("Trimming data to " + datapointsCount + " points")

    const from = new Date(response[0].timestamp).getTime();
    const to = new Date(response.slice(-1)[0].timestamp).getTime();

    console.log("from: " + from)
    console.log("to: " + to)

    const rangeMillis = to - from

    console.log(rangeMillis / (1000 * 60 * 60 * 24))

    const targetStepSize = Math.round(rangeMillis / (datapointsCount - 1))

    //console.log(targetStepSize / (1000 * 60 * 60 * 24))
    //console.log(rangeMillis / datapointsCount)

    const trimmedResponse = []

    var timestamp = from

    for (var i = 0; i < datapointsCount; i++) {
        console.log("Target timestamp added: " + timestamp)

        const dataPoint = getClosestDatapoint(response, timestamp);

        trimmedResponse.push(dataPoint);

        timestamp = timestamp + targetStepSize
    }

    return trimmedResponse
}

function getClosestDatapoint(response, targetTimestamp) {
    var closestDatapointIndex = 0;
    var closestTimeOffset = null;

    for (let index in response) {

        const datapointTimestamp = response[index].timestamp
        const diff = new Date(datapointTimestamp).getTime() - targetTimestamp
        const diffAbsolute = Math.abs(diff);

        //console.log("Target: " + targetTimestamp + " Checking index " + index + " in the response. Time diff: " + diff)

        if (!closestTimeOffset) {
            //console.log("setting first datapoint, index = " + index)
            closestTimeOffset = diffAbsolute;
            closestDatapointIndex = index;
        }

        //console.log("diffAbsolute: " + diffAbsolute + " closestTimeOffset: " + closestTimeOffset)
        //console.log("closestDatapointIndex: " + closestDatapointIndex)

        if (diffAbsolute < closestTimeOffset) {
            //console.log("found new closest")
            closestTimeOffset = diffAbsolute;
            closestDatapointIndex = index;
        }
    }
    console.log("Closest datapoint was index " + closestDatapointIndex)
    return response[closestDatapointIndex]
}

function getTimestampRangeInDays(fromInput, toInput) {
    const from = new Date(fromInput);
    console.log("From: " + from)

    const to = new Date(toInput);
    console.log("To: " + to)

    const diffMilliseconds = to.getTime() - from.getTime()

    const diffDays = diffMilliseconds / (1000 * 60 * 60 * 24);
    console.log("Time range in days: " + diffDays)
    return diffDays
}

function returnResponse(response,params) {
    db.close()

    if (params && params.unixEpochTimestamp==="true") {
        for (let entry of response) {
            entry.timestamp = new Date(entry.timestamp).getTime();
        }
    }

    awsCallback(null, {
        statusCode: 200,
        "headers": { "Access-Control-Allow-Origin": "*"},
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
