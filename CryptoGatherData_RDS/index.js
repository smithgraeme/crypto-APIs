const mysqlPromise = require('mysqlPromise');
const got = require('got');

var db

exports.handler = async function(event, context, callback) {
    context.callbackWaitsForEmptyEventLoop = true;

    var response = await got('https://api.coinmarketcap.com/v1/ticker/', { json: true });

    //console.log(response.body[3]);

    db = new mysqlPromise({
        host: process.env.host,
        user: process.env.username,
        password: process.env.password,
        database: "cryptocurrency",
    });

    const existingCoins = await getExistingCoins();

    for (const coin of response.body) {
        //console.log(coin.name)

        const coinID = await setupCoin(coin, existingCoins);
        await updatePrice(coin)
    }

    db.close().catch()
};

async function setupCoin(coin, existingCoins) {
    if (!(existingCoins.includes(coin.id))) {
        await db.query("INSERT INTO `coin` (`name`, `identifier`, `symbol`) VALUES('" + coin.name + "', '" + coin.id + "', '" + coin.symbol + "');");
    }
    else {
        await db.query(`UPDATE coin SET name="${coin.name}", symbol="${coin.symbol}" WHERE identifier = "${coin.id}"`)
    }
}

async function getExistingCoins() {
    const existingCoinsQuery = await db.query("select * from coin");
    //console.log(result)
    const existingCoins = []

    for (const coin of existingCoinsQuery)
        existingCoins.push(coin.identifier)
        
    //console.log(existingCoins)
    return existingCoins
}

async function updatePrice(coin) {
    await db.query("INSERT INTO `coinPrices` (`priceUSD`, `coinIdentifier`) VALUES('" + coin.price_usd + "', '" + coin.id + "');");
}
