class foo {
    constructor (client) {
        console.log(client);
    }
}

module.exports = (client) => { return new foo(client) }