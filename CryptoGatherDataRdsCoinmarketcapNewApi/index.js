const dbLib = require('mysqlPromise');
const got = require('got');

var db;

exports.handler = async function(event, context, callback) {
    console.log(JSON.stringify(event));
    console.log("Target coin count: " + event.coinCount);
    
    context.callbackWaitsForEmptyEventLoop = true;

    const options = {
        json: true,
        headers: {
            "X-CMC_PRO_API_KEY": process.env.coinmarketcapProApiKey
        }
    };
    
    const response = await got('https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=' + event.coinCount, options);

    const coins = response.body.data;
    
    console.log("Coin count: " + coins.length);

    console.log(JSON.stringify(coins));

    db = new dbLib({
        host: process.env.host,
        user: process.env.username,
        password: process.env.password,
        database: "cryptocurrency",
    });

    const existingCoins = await getExistingCoins();

    for (const coin of coins) {

        const parsedCoin = {};

        parsedCoin.name = coin.name;
        parsedCoin.id = coin.slug;
        parsedCoin.symbol = coin.symbol;
        parsedCoin.price_usd = coin.quote.USD.price;
        parsedCoin.market_cap_usd = coin.quote.USD.market_cap;

        const iconURL = `https://chasing-coins.com/api/v1/std/logo/${coin.symbol}`;

        console.log(parsedCoin);

        await setupCoin(parsedCoin, existingCoins, iconURL);
        await addNewPrice(parsedCoin);
    }
    
    console.log("Done!");

    await db.close();
};

async function setupCoin(coin, existingCoins, iconURL) {
    // console.log(`Updating ${coin.id}`)

    if (!(existingCoins.includes(coin.id)))
        await db.query("INSERT INTO `coin` (`identifier`) VALUES(?);", [coin.id]);

    const query = `UPDATE coin SET name = ?, symbol = ?, iconURL = ?, marketCapUSD = ? WHERE identifier = ?`;
    const args = [coin.name, coin.symbol, iconURL, coin.market_cap_usd, coin.id];
    await db.query(query, args);
}

async function getExistingCoins() {
    const existingCoinsQuery = await db.query("select * from coin");

    const existingCoins = [];

    for (const coin of existingCoinsQuery)
        existingCoins.push(coin.identifier);

    //console.log(existingCoins)
    return existingCoins;
}

async function addNewPrice(coin) {
    await db.query("INSERT INTO `coinPrices` (`priceUSD`, `coinIdentifier`, `dataSource`) VALUES('" + coin.price_usd + "', '" + coin.id + "', ' CoinmarketcapProApi ');");
}
