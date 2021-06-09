let express = require("express");
let app = express();

let log4js = require('log4js');
log4js.configure({
    appenders: {myWallapop: {type: 'file', filename: 'logs/myWallapop.log'}},
    categories: {default: {appenders: ['myWallapop'], level: 'trace'}}
});
let logger = log4js.getLogger('myWallapop');
app.set('logger', logger);

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "POST, GET, DELETE, UPDATE, PUT");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, token");
    next();
});

//Para la segunda parte
let rest = require('request');
app.set('rest',rest);

let jwt = require("jsonwebtoken");
app.set("jwt",jwt);

let expressSession = require('express-session');
app.use(expressSession({
    secret: 'abcdefg',
    resave: true,
    saveUninitialized: true
}));

let crypto = require('crypto');
let fileUpload = require('express-fileupload');
app.use(fileUpload());
let mongo = require('mongodb');
let swig = require("swig");
let bodyParser = require("body-parser");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


//Inicialización de los gestores de bases de datos MongoDB
let gestorProductos = require("./modules/gestorProductos.js");
let gestorUsuarios = require("./modules/gestorUsuarios.js");
let gestorChat = require("./modules/gestorChat.js");
gestorUsuarios.init(app,mongo);
gestorProductos.init(app,mongo);
gestorChat.init(app,mongo);



app.use(express.static("public"));

app.set("port", 8081);
app.set('db', 'mongodb://admin:sdi@tiendamusica-shard-00-00.essby.mongodb.net:27017,tiendamusica-shard-00-01.essby.mongodb.net:27017,tiendamusica-shard-00-02.essby.mongodb.net:27017/myWallapop?ssl=true&replicaSet=atlas-u3t42f-shard-0&authSource=admin&retryWrites=true&w=majority');
app.set('clave','abcdefg');
app.set('crypto',crypto);


//ROUTERS
let routerTokenDeUsuario = express.Router();
routerTokenDeUsuario.use(function(req, res, next) {
    let token = req.headers['token'] || req.body.token || req.query.token;
    if (token != null) {
        // Checkeamos que es correcto
        jwt.verify(token, 'secreto', function(err, infoToken) {
            if (err || (Date.now()/1000 - infoToken.tiempo) > 240 ){
                res.status(403); // Forbidden
                res.json({
                    acceso : false,
                    error: 'El token recibido es inválido, ya ha caducado'
                });
            } else {
                res.usuario = infoToken.usuario;
                next();
            }
        });

    } else {
        res.status(403); // Forbidden
        res.json({
            acceso : false,
            mensaje: 'No hay token de usuario'
        });
    }
});

app.use('/api/ofertas', routerTokenDeUsuario);
app.use('/api/chat', routerTokenDeUsuario);
app.use('/api/mensaje', routerTokenDeUsuario);

//Router para la vista de admin
let routerVistaAdmin = express.Router();
routerVistaAdmin.use(function(req, res, next) {
    if ( req.session.usuario ) {
        if (req.session.usuario === 'admin@admin.com') {
            next();
        } else {
            res.redirect('/publicaciones');
        }
    }
    else {
        res.redirect('/identificarse')
    }
});

app.use("/administrar",routerVistaAdmin);

//Router para garantizar que la vista de bienvenida solo está accessible para usuarios no identificados
let routerNoAutenticado = express.Router();
routerNoAutenticado.use(function(req, res, next) {
    if ( req.session.usuario ) {
        if (req.session.usuario === 'admin@admin.com') {
            res.redirect('/administrar');
        } else {
            res.redirect('/publicaciones');
        }
    }
    else {
        next();
    }
});
app.use("/iniciar",routerNoAutenticado);

//Router para garantizar que la vista de bienvenida solo está accessible para usuarios no identificados
let routerAutenticado = express.Router();
routerAutenticado.use(function(req, res, next) {
    if ( req.session.usuario ) {
        next();
    }
    else {
        res.redirect('/identificarse');
    }
});

app.use("/tienda", routerAutenticado);

//Router para permitir acceder a las vistas de compra/añadir producto... solo a usuarios logueados y no admins
let routerUsuarioNoAdmin = express.Router();
routerUsuarioNoAdmin.use(function(req, res, next) {
    if ( req.session.usuario ) {
        if( req.session.usuario !== 'admin@admin.com'){
            next();
        }
        else {
            res.redirect("/administrar");
        }
    } else {
        res.redirect("/iniciar");
    }
});
app.use("/tienda",routerUsuarioNoAdmin);
app.use("/producto/agregar",routerUsuarioNoAdmin);
app.use("/publicaciones",routerUsuarioNoAdmin);
app.use("/producto/comprar",routerUsuarioNoAdmin);
app.use("/compras",routerUsuarioNoAdmin);

//Router para ver si el usuario es el dueño de una oferta determinada (autor-canción mod.) antes de poder borrarla
let routerEsPropietario = express.Router();
routerEsPropietario.use(function(req, res, next) {
    let path = require('path');
    let id = path.basename(req.originalUrl);
    gestorProductos.obtenerProductos(
        {_id: mongo.ObjectID(id) }, function (productos) {
            if(productos[0].propietario === req.session.usuario ){
                next();
            } else {
                res.redirect("/tienda");
            }
        })
});

app.use("/producto/eliminar",routerEsPropietario);



require("./routes/rusuarios.js")(app,swig,gestorUsuarios, gestorProductos);
require("./routes/rproductos.js")(app,swig,gestorUsuarios, gestorProductos);
require("./routes/rapiusuarios.js")(app, gestorUsuarios);
require("./routes/rapiproductos.js")(app, gestorProductos);
require("./routes/rapimensajes.js")(app, gestorProductos,gestorChat);

//Endpoint básico, en caso de admin no hay productos a la venta, con lo que se envía a tienda
app.get('/', function(req,res){
    if(req.session.usuario) {
        if(req.session.usuario === 'admin@admin.com'){
            res.redirect('/tienda');
        }
        else {
            res.redirect('/publicaciones');
        }
    }
    else{
        res.redirect('/iniciar');
    }
});

//Mensaje inicial para notificar en dev
app.listen(app.get('port'), function () {
    console.log("Server activo");
});



