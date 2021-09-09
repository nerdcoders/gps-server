module.exports = {
    apps: [{
        name: "TCP Server",
        script: "./tcp/index.js",
        out_file: "/var/www/node/concox/out.log",
        error_file: "/var/www/node/concox/error.log",
        restart_delay: 3000,
        time: true
    }]
}
