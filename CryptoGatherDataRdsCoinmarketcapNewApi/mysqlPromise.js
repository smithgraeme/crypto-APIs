const mysql = require('mysql');

class mysqlPromise {
    
    constructor(configuration) {
        this.connection = mysql.createConnection(configuration);
    }

    query(query, queryArguments) {
        return new Promise((resolve, reject) => {
            this.connection.query(query, queryArguments, (error, result) => {

                if (error) {
                    return reject(error);
                }
                else {
                    resolve(result);
                }
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            this.connection.end(error => {

                if (error) {
                    return reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
}

module.exports = mysqlPromise;
