const server = require("net").createServer();
const parser = require("./parser");
const config = require("../config");
const helpers = require("./helpers.js");
const helpers_ = require("./parser/helpers.js");
////const ota_save_to_db = require("./save_ota_command_to_db.js");
const inspector = require("event-loop-inspector")();
////const ota_commands = require("./ota_commands_manager.js");
const Promise = require("bluebird");
const sockets = {};
const app = require("express")();

const fetch_send_ota_commands = () => {
    // ota_commands
    //     .members()
    //     .then((r) => {
    //         return Promise.map(
    //             r.filter(
    //                 (k) =>
    //                     k.imei &&
    //                     k.message_to_send &&
    //                     sockets[k.imei] &&
    //                     sockets[k.imei].socket.readyState === "open"
    //             ),
    //             (k) => {
    //                 send_ota_command(k.imei, sockets[k.imei].socket, sockets[k.imei].info_serial_no, k.message_to_send);
    //                 return ota_commands.remove(k);
    //             },
    //             {
    //                 concurrency: 5,
    //             }
    //         );
    //     })
    //     .then((r) => {})
    //     .catch((e) => {
    //         console.error(e);
    //     });
};

// // setInterval(() => {
// //     fetch_send_ota_commands();
// // }, 60000);

app.get("/inspector", (req, res) => {
    res.json(inspector.dump());
});

app.listen(9999, () => {
    console.log("Event loop inspector listening");
});

const send_ota_command = (imei, socket, serial_no, __message) => {
    // console.log("ota", imei, serial_no, __message);
    // console.log("ota", imei, __message);
    const command = helpers_.ascii_to_hex(__message);
    const server_flag_bit = "00000000";
    const length_of_command = (command.match(/.{2}/g).length + 4)
        .toString(16)
        .padStart(2, "0");
    const language = "0002";
    const serial = (serial_no + 1).toString(16).padStart(4, "0");
    const info_content =
        length_of_command + server_flag_bit + command + language;
    const data_length = (1 + info_content.match(/.{2}/g).length + 2 + 2)
        .toString(16)
        .padStart(2, "0");
    const data = data_length + "80" + info_content + serial;
    const message = helpers_.appendStartEnd(`${data}${helpers_.crc16(data)}`);
    // console.log("ota", imei, message);
    socket.write(
        Buffer.from(message.match(/.{2}/g).map((i) => parseInt(i, 16)))
    );
    ota_save_to_db([
        {
            imei,
            time: Date.now(),
            content: __message,
        },
    ]);
};

server.on("connection", (socket) => {
    socket.setEncoding("hex");
    const client = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(new Date(),'DEVICE CONNECTED',client);
    socket.setKeepAlive(true, 50000);
    let imei = null;
    socket.on("data", (data) => {
        
        console.log('event','received-data',data);

        const parsed__ = parser(data);
        

        if (
            Array.isArray(parsed__) &&
            parsed__.length > 0 &&
            typeof parsed__[0] === "object" &&
            parsed__[0].case
        ) {
            imei =
                parsed__[0].case === "01"
                    ? helpers.imei_manager.set(
                          parsed__[0].imei,
                          socket.remoteAddress,
                          socket.remotePort
                      )
                    : helpers.imei_manager.get(
                          socket.remoteAddress,
                          socket.remotePort
                      );
            if (imei) {
                sockets[imei] = {
                    socket,
                    info_serial_no: parsed__[0].info_serial_no,
                };
                helpers.data_middleware(
                    parsed__.map((k) => ({
                        ...k,
                        imei,
                        socket: client,
                    }))
                );
                if (parsed__[0].tag === "Online Command") {
                    console.log(
                    ////ota_save_to_db(
                        parsed__.map((k) => ({
                            ...k,
                            imei,
                            time: Date.now(),
                            socket: client,
                        }))
                    );
                }
            }
            parsed__
                .filter((k) => k.output)
                .forEach((k) => {
                    socket.write(
                        Buffer.from(
                            k.output.match(/.{2}/g).map((i) => parseInt(i, 16))
                        )
                    );
                });
        ////} else helpers.send_invalid_data_to_api(data);
            }else console.log('invalida data',data);
    });
    socket.on("error", (err) => {
        console.error({ event: "error", err: err.message, client });
        socket.end();
    });
    socket.on("close", () => {
        console.log({ event: "close", client });
        if (imei) delete sockets[imei];
        helpers.imei_manager.delete(client);
    });
    socket.setTimeout(1000 * 60 * 30, () => {
        console.log("Socket Timeout", client);
        if (imei) delete sockets[imei];
        helpers.imei_manager.delete(client);
        socket.end();
    });
    socket.on("end", (hadError) => {
        if (imei) delete sockets[imei];
        helpers.imei_manager.delete(client);
        console.log({ event: "end", client, hadError });
    });
});
server.on("error", (err) => {
    console.error({ event: "Server error", err });
});
server.on("close", (err) => {
    console.log({ event: "Server close", err });
});

server.listen(config.CONCOX_TCP_PORT, () => {
    console.log({
        event: "CONCOX_TCP_SERVER STARTED",
        PORT: config.CONCOX_TCP_PORT,
    });
});

process.on("unhandledRejection", (reason, promise) => {
    console.error({
        event: "Unhandled Rejection at:",
        err: reason.stack ? reason.stack.toString() : reason,
    });
});