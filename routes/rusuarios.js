module.exports = function (app, swig, gestorUsuarios, gestorProductos) {

    app.get("/iniciar", function (req, res) {
        let respuesta = swig.renderFile('views/bhome.html', {});
        res.send(respuesta);
    });

    app.get("/registrarse", function (req, res) {
        let respuesta = swig.renderFile('views/bregistrarse.html', {});
        res.send(respuesta);
    });

    app.get("/identificarse", function (req, res) {
        let respuesta = swig.renderFile('views/bidentificarse.html', {});
        res.send(respuesta);
    });

    app.post('/usuario', function (req, res) {
        let seguro = app.get("crypto").createHmac('sha256', app.get('clave'))
            .update(req.body.password).digest('hex');
        let usuario = {
            email: req.body.email,
            password: seguro,
            nombre: req.body.nombre,
            apellidos: req.body.apellidos,
            isAdmin: false,
            saldo: 100.0
        }
        gestorUsuarios.obtenerUsuarios({email: req.body.email}, function (users) {
            if (users.length > 0) {
                res.redirect("/registrarse?mensaje=El usuario ya existe" + "&tipoMensaje=alert-danger");
            } else if (usuario.nombre.length <= 1) {
                res.redirect("/registrarse?mensaje=El nombre es muy corto" + "&tipoMensaje=alert-danger");
            } else if (usuario.apellidos.length <= 1) {
                res.redirect("/registrarse?mensaje=Los apellidos son muy cortos" + "&tipoMensaje=alert-danger");
            } else if (usuario.email.length === 0) {
                res.redirect("/registrarse?mensaje=El email es muy corto" + "&tipoMensaje=alert-danger");
            } else if (req.body.password !== req.body.reppassword) {
                res.redirect("/registrarse?mensaje=Las contraseñas no coinciden" + "&tipoMensaje=alert-danger");
            } else {
                gestorUsuarios.insertarUsuario(usuario, function (idUsuario) {
                    if (idUsuario == null) {
                        res.redirect("/registrarse?mensaje=Error al registrarse")
                    } else {
                        app.get("logger").info("Usuario " + usuario.email + " registrado con exito");
                        res.redirect("/identificarse?mensaje=Usuario registrado con exito");
                    }
                });
            }
        });
    });

    app.post("/identificarse", function (req, res) {
        let seguro = app.get("crypto").createHmac('sha256', app.get('clave'))
            .update(req.body.password).digest('hex');
        let criterio = {
            email: req.body.email,
            password: seguro
        }
        gestorUsuarios.obtenerUsuarios(criterio, function (usuarios) {
            if (usuarios == null || usuarios.length === 0) {
                req.session.usuario = null;
                res.redirect("/identificarse?mensaje=Los datos no son validos" + "&tipoMensaje=alert-danger");
            } else {
                req.session.usuario = usuarios[0].email;
                req.session.saldo = usuarios[0].saldo;
                if (usuarios[0].email === "admin@admin.com") {
                    app.get("logger").info("Usuario administrador " + usuarios[0].email + " identificado con éxito");
                    res.redirect("/administrar")
                } else {
                    app.get("logger").info("Usuario " + usuarios[0].email + " identificado con éxito");
                    res.redirect("/publicaciones");
                }
            }
        });
    });

    app.get('/desconectarse', function (req, res) {
        app.get("logger").info("Usuario " + req.session.usuario + " desconectado con éxito");
        req.session.usuario = null;
        res.redirect("/identificarse");
    });

    app.get('/administrar', function (req, res) {
        var criterio = {
            isAdmin: false
        };
        gestorUsuarios.obtenerUsuarios(criterio, function (usuarios) {
            var respuesta = swig.renderFile('views/badmin.html', {
                usuarios: usuarios,
                usuario: req.session.usuario
            });
            res.send(respuesta);
        });
    });

    app.post('/usuario/eliminar', function (req, res) {
        let usuarios = {};
        let productos = {};
        if (typeof req.body.usuarios !== 'undefined') {
            if (typeof req.body.usuarios === "string") {
                usuarios = {
                    email: req.body.usuarios
                };
                productos = {
                    propietario: req.body.usuarios
                };
            }
            else if (typeof req.body.usuarios === 'object') {
                usuarios = {
                    email: {$in: req.body.usuarios}
                };
                productos = {
                    propietario: {$in: req.body.usuarios}
                };
            }
            gestorUsuarios.eliminarUsuario(usuarios, function (deleted) {
                if (deleted == null) {
                    res.redirect('/administrar?mensaje=Se ha producido un error' + "&tipoMensaje=alert-danger");
                }
            });
            gestorProductos.eliminarProducto(productos, function (deleted) {
                if (deleted == null) {
                    res.redirect('/administrar?mensaje=Se ha producido un error' + "&tipoMensaje=alert-danger");
                }
            });
        }
        app.get("logger").info("Usuarios eliminados");
        res.redirect("/administrar");
    });
};