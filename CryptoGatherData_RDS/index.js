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
        //console.log(coin.id)
        //console.log(coin.symbol)

        const iconURL = `https://chasing-coins.com/api/v1/std/logo/${coin.symbol}`;

        await setupCoin(coin, existingCoins, iconURL);
        await addNewPrice(coin);
    }

    db.close().catch();
};

async function setupCoin(coin, existingCoins, iconURL) {
    // console.log(`Updating ${coin.id}`)

    if (!(existingCoins.includes(coin.id))) {

        await db.query("INSERT INTO `coin` (`name`, `identifier`, `symbol`) VALUES('" + coin.name + "', '" + coin.id + "', '" + coin.symbol + "');");

    }
    else {

        const query = `UPDATE coin SET name = ?, symbol = ?, iconURL = ? WHERE identifier = ?`;
        const args = [coin.name, coin.symbol, iconURL, coin.id];
        await db.query(query, args);

    }
}

async function getExistingCoins() {
    const existingCoinsQuery = await db.query("select * from coin");
    //console.log(result)
    const existingCoins = [];

    for (const coin of existingCoinsQuery)
        existingCoins.push(coin.identifier);

    //console.log(existingCoins)
    return existingCoins;
}

async function addNewPrice(coin) {
    await db.query("INSERT INTO `coinPrices` (`priceUSD`, `coinIdentifier`) VALUES('" + coin.price_usd + "', '" + coin.id + "');");
}
