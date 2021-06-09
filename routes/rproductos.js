module.exports = function (app, swig, gestorUsuarios, gestorProductos) {

    app.post("/producto", function (req, res) {
        if (req.body.nombre === '' || req.body.descripcion === '' ||
            req.body.precio === '' || req.body.nombre.length <= 2 || req.body.precio <= 0) {
            res.send("Los datos del producto son erróneos");
        } else {
            let producto = {
                nombre: req.body.nombre,
                descripcion: req.body.descripcion,
                precio: req.body.precio,
                fecha: new Date(),
                propietario: req.session.usuario,
                comprador: null,
            };
            gestorProductos.insertarProducto(producto, function (id) {
                if (id == null) {
                    res.send("Error al añadir el producto");
                } else {
                    app.get("logger").info("Producto añadido con éxito");
                    res.redirect("/publicaciones");
                }
            });
        }
    })

    app.get('/producto/agregar', function (req, res) {
        let respuesta = swig.renderFile('views/bpublicar.html', {
            usuario: req.session.usuario,
            saldo: req.session.saldo
        });
        res.send(respuesta);
    });

    app.get("/tienda", function (req, res) {
        let criterio = {};
        if (req.query.busqueda != null) {
            criterio = {
                "nombre": {$regex: ".*" + req.query.busqueda + ".*", $options: 'i'},
            };
        }
        let pg = parseInt(req.query.pg);
        if (req.query.pg == null) {
            pg = 1;
        }
        gestorProductos.obtenerProductosConPaginacion(criterio, pg, function (productos, total) {
            if (productos == null) {
                res.send("Error al acceder a los productos");
            } else {
                let ultimaPg = total / 5;
                if (total % 5 > 0) {
                    ultimaPg = ultimaPg + 1;
                }
                let paginas = [];
                for (let i = pg - 2; i <= pg + 2; i++) {
                    if (i > 0 && i <= ultimaPg) {
                        paginas.push(i);
                    }
                }
                let respuesta = swig.renderFile('views/btienda.html',
                    {
                        productos: productos,
                        usuario: req.session.usuario,
                        saldo: req.session.saldo,
                        paginas: paginas,
                        actual: pg
                    });
                app.get("logger").info("Acceso a la tienda");
                res.send(respuesta);
            }
        });
    });

    app.get("/publicaciones", function (req, res) {
        let criterio = {propietario: req.session.usuario};
        gestorProductos.obtenerProductos(criterio, function (productos) {
            if (productos == null) {
                res.send("Error en mis publicaciones");
            } else {
                let respuesta = swig.renderFile('views/bpublicaciones.html',
                    {
                        productos: productos,
                        usuario: req.session.usuario,
                        saldo: req.session.saldo
                    });
                app.get("logger").info("Acceso a mis publicaciones");
                res.send(respuesta);
            }
        });
    });

    app.get('/producto/eliminar/:id', function (req, res) {
        let criterio = {"_id": gestorProductos.mongo.ObjectID(req.params.id)};
        gestorProductos.obtenerProductos(criterio, function (productos) {
            if (productos[0].propietario != req.session.usuario) {
                res.redirect("/publicaciones?mensaje=No eres el propietario de esta oferta" + "&tipoMensaje=alert-danger");
            } else if (productos[0].comprador != null) {
                res.redirect("/publicaciones?mensaje=Esta oferta no está disponible porque ha sido comprada" + "&tipoMensaje=alert-danger");
            } else {
                gestorProductos.eliminarProducto(criterio, function (productos1) {
                    if (productos1 == null) {
                        res.redirect("/publicaciones?mensaje=Ha ocurrido un error" + "&tipoMensaje=alert-danger");
                    } else {
                        app.get("logger").info("Producto " + productos[0].nombre + " eliminado con éxito");
                        res.redirect("/publicaciones");
                    }
                });
            }
        });
    });

    app.get('/producto/comprar/:id', function (req, res) {
        var productoId = gestorProductos.mongo.ObjectID(req.params.id);
        var criterio = {
            "_id": productoId
        };
        var producto = {
            "comprador": req.session.usuario
        };
        gestorProductos.obtenerProductos(criterio, function (productos) {
            if (productos == null) {
                res.redirect("/tienda?mensaje=Ha ocurrido un error inesperado" + "&tipoMensaje=alert-danger");
            } else {
                var usuarios = {
                    email: req.session.usuario
                };
                gestorUsuarios.obtenerUsuarios(usuarios, function (users) {
                        if (productos[0].precio > users[0].saldo) {
                            res.redirect("/tienda?mensaje=No tienes suficiente dinero" + "&tipoMensaje=alert-danger");
                        } else {
                            if (productos[0].propietario !== req.session.usuario && productos[0].comprador == null) {
                                gestorProductos.modificarProducto(criterio, producto, function (idCompra) {
                                    if (idCompra == null) {
                                        res.redirect("/tienda?mensaje=Ha ocurrido un error inesperado" + "&tipoMensaje=alert-danger");
                                    } else {
                                        var saldoActualizado = {
                                            saldo: users[0].saldo - productos[0].precio
                                        };
                                        req.session.saldo = users[0].saldo - productos[0].precio;
                                        gestorUsuarios.modificarUsuarios(usuarios, saldoActualizado, function (users1) {
                                                if (users1 == null)
                                                    res.redirect("/tienda?mensaje=Ha ocurrido un error inesperado" + "&tipoMensaje=alert-danger");
                                                else
                                                    app.get("logger").info("Compra realizada con éxito");
                                                res.redirect("/compras");
                                            }
                                        );
                                    }
                                });
                            } else {
                                res.redirect("/tienda?mensaje=Ha ocurrido un error inesperado" + "&tipoMensaje=alert-danger");
                            }
                        }
                    }
                );
            }
        });
    });

    app.get('/compras', function (req, res) {
        let criterio = {"comprador": req.session.usuario};
        gestorProductos.obtenerProductos(criterio, function (productos) {
            if (productos == null) {
                res.send("Error al acceder a mis compras");
            } else {
                let respuesta = swig.renderFile('views/bcompras.html',
                    {
                        productos: productos,
                        usuario: req.session.usuario,
                        saldo: req.session.saldo
                    });
                app.get("logger").info("Acceso a mis compras");
                res.send(respuesta);
            }
        });
    });

};