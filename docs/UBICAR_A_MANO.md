# Sitios para ubicar a mano (geocodificación pendiente)

Salida de F3 (2026-08-13). Nominatim no tiene números de placa para la mayoría de direcciones colombianas: estos 133 sitios quedaron con `lat/lng: null` en `/data/sitios.json`. La **pista** es el centroide de la vía que devolvió Nominatim — punto de partida para ubicar el sitio en un mapa, NO la coordenada del sitio (por eso no se escribió).

**Cómo resolver uno:** busca la dirección en un mapa (la pista te deja en la calle correcta) → edita el sitio en `/data/sitios.json` poniendo `lat` y `lng` → `cd scraper && npm run validate` → commit. El geocodificador jamás toca coordenadas ya puestas (solo llena nulls), así que tu edición es permanente sin necesidad de `manual: true` (ponlo solo si además cambias otros campos).

**Atajos:** direcciones repetidas resuelven varios sitios de un golpe — "Carrera 38 Bis # 5-91" (Cali) cubre 3 sitios; "Calle 30 # 44D-71" (Cartagena) cubre 2; "Calle 19A # 32-50" (Bogotá) cubre 2. Posibles duplicados que F5 detectará: `banco-de-alimentos` / `banco-de-alimentos-de-bogota-calle-19a` · `unicentro` / `alcaldia-de-bogota-cruz-roja-carrera-15` (misma dirección escrita distinto, con pistas distintas — verificar a mano cuál "Carrera 15" es).

| id | nombre | ciudad | dirección original | pista (centroide de vía) |
|---|---|---|---|---|
| acriya-sas | ACRIYA SAS | Bogotá | Calle 70 # 20-55 | 4.7093854, -74.1319798 |
| alcaldia-de-barranquilla | Alcaldía de Barranquilla | Barranquilla | Carrera 43 #6-120 | 10.986476, -74.7977004 |
| alcaldia-de-bogota-cruz-roja-calle-63 | Alcaldía de Bogotá / Cruz Roja | Bogotá | Calle 63 # 59A-06 (Palacio de los Deportes) | 4.6444096, -74.0546171 |
| alcaldia-de-bogota-cruz-roja-carrera-15 | Alcaldía de Bogotá / Cruz Roja | Bogotá | Carrera 15 # 124-30 (Unicentro) | 4.706552, -74.0425826 |
| alcaldia-de-bogota-cruz-roja-carrera-24 | Alcaldía de Bogotá / Cruz Roja | Bogotá | Carrera 24 # 73-38 (Sede administrativa) | 4.5688329, -74.1482574 |
| alcaldia-de-manizales | Alcaldía de Manizales | Manizales | Av. Kevin Ángel # 59-181 | 5.0706879, -75.5002859 |
| alcaldia-de-santiago-de-cali | Alcaldía de Santiago de Cali | Cali | Carrera 38 Bis # 5-91 | 3.4235938, -76.5436446 |
| alcaldia-municipal-de-dosquebradas | Alcaldía municipal de Dosquebradas | Dosquebradas | Plazoleta del CAM | — |
| apostolinas-colombia-bogota | Apostolinas Colombia | Bogotá | Calle 35 # 24-40 Apto 201 | 4.6219187, -74.0654825 |
| asociacion-de-scouts-de-colombia | Asociación de Scouts de Colombia | Medellín | Carrera 82 #34C - 18 | 6.1784542, -75.6602253 |
| banco-arquidiocesano-de-alimentos-de-bucaramanga | Banco Arquidiocesano de Alimentos de Bucaramanga | Bucaramanga | Carrera 20 # 11-46 | 7.0821738, -73.1175988 |
| banco-arquidiocesano-de-alimentos-de-ibague | Banco Arquidiocesano de Alimentos de Ibagué | Ibagué | Carrera 4 Estadio No. 23-42/44 | 4.4302801, -75.2155935 |
| banco-de-alimentos | Banco de Alimentos | Bogotá | Calle 19A # 32-50 | 4.6547691, -74.1260648 |
| banco-de-alimentos-arquidiocesis-de-cartagena-avenida-3 | Banco de Alimentos Arquidiócesis de Cartagena | Cartagena | Avenida 3 # 70-32. Parroquia Cristo Rey | — |
| banco-de-alimentos-arquidiocesis-de-cartagena-carrera-5 | Banco de Alimentos Arquidiócesis de Cartagena | Cartagena | Carrera 5 No.34-55. Capilla Nuestra Señora de Guadalupe | 10.5330243, -75.4004654 |
| banco-de-alimentos-arquidiocesis-de-cartagena-carrera-6 | Banco de Alimentos Arquidiócesis de Cartagena | Cartagena | Carrera 6 # 7 -122 Parroquia Nuestra Señora del Perpetuo Socorro | 10.4475273, -75.5184143 |
| banco-de-alimentos-arquidiocesis-de-villavicencio | Banco de Alimentos Arquidiocesis de Villavicencio | Villavicencio | Calle 23C # 22-02 | 4.1398908, -73.6232667 |
| banco-de-alimentos-de-bogota-calle-19a | Banco de Alimentos de Bogotá | Bogotá | Calle 19A # 32-50 | 4.6547691, -74.1260648 |
| banco-de-alimentos-de-buenaventura | Banco de Alimentos de Buenaventura | Buenaventura | Av. Simón Bolívar # 47C-70 | — |
| banco-de-alimentos-de-manizales | Banco de Alimentos de Manizales | Manizales | Calle 49 # 27A - 85 | 5.0795171, -75.4889824 |
| banco-de-alimentos-de-pereira | Banco de Alimentos de Pereira | Pereira | Parroquia San Marcos Evangelista (Barrio Santa Isabel - Dosquebradas) | — |
| banco-de-alimentos-monsenor-roberto-lopez-londono | Banco de Alimentos Monseñor Roberto López Londoño | Armenia | Calle 21 No. 12-25 | 4.5382606, -75.6786661 |
| banco-de-ropas-minuto-de-dios | Banco de Ropas / Minuto de Dios | Bogotá | Transversal 73A # 82-61 | 4.6990019, -74.0895659 |
| banco-distrital-de-sangre | Banco Distrital de Sangre | Bogotá | Av. Carrera 68 # 68B-31 (principal; ver idcbis.org.co) | 4.6322647, -74.1212127 |
| banco-regional-armenia | Banco Regional Armenia | Armenia | Av. Bolívar # 23 Norte - 60 | 4.5367653, -75.6686575 |
| banco-regional-cali | Banco Regional Cali | Cali | Carrera 38 Bis # 5-91 | 3.4235938, -76.5436446 |
| banco-regional-cartagena | Banco Regional Cartagena | Cartagena | Calle 30 # 44D-71 | 10.3837085, -75.4681146 |
| banco-regional-medellin | Banco Regional Medellín | Medellín | Carrera 52 # 25-310 | 6.2501537, -75.5696198 |
| cafe-libertario-bogota-calle-119b | Café Libertario | Bogotá | Calle 119B # 5-43 | 4.6959967, -74.0300123 |
| cafe-libertario-medellin | Café Libertario | Medellín | Diagonal 75 # 39cb-20 | — |
| casa-de-la-paz | Casa de la Paz | Bogotá | Carrera 13 # 36-37 | 4.6805921, -74.0475494 |
| casa-jardin-origen-bogota-calle-38 | Casa Jardín Origen | Bogotá | Calle 38 # 29-29 | 4.6263722, -74.0798609 |
| casa-jardin-origen-bogota-calle-38-voluntariado | Casa Jardín Origen | Bogotá | Calle 38 # 29-29 | 4.6263722, -74.0798609 |
| centro-deportivo-luz-mery-tristan | Centro Deportivo Luz Mery Tristán | Cali | Calle 18 #180 - 00 | 3.4563156, -76.5280421 |
| clinica-colsanitas | Clínica Colsánitas | Bogotá | Calle 166 # 22-68 | 4.7436924, -74.0280365 |
| clinica-de-marly | Clinica de Marly | Bogotá | Calle 50 # 9-67, piso 2 | 4.670535, -74.1104853 |
| clinimedical-group | Clinimedical Group | Pasto | Calle 16D # 40-49 | 1.1991664, -77.2697949 |
| club-activo-20-30-bogota-carrera-7 | Club Activo 20-30 | Bogotá | Carrera 7 # 130-50, torre 2, apto 603 | 4.5573634, -74.1194576 |
| club-activo-20-30-bogota-carrera-9 | Club Activo 20-30 | Bogotá | Carrera 9 # 77-66, apto 901 | 4.6747292, -74.0443734 |
| colectivo-afroudea-medellin-bajos-bloque | Colectivo AfroUdeA | Medellín | Bajos del Bloque 9 | — |
| colectivo-afroudea-medellin-universidad-antioquia | Colectivo AfroUdeA | Medellín | Universidad de Antioquia Bajos del Bloque 9 | — |
| comite-de-accion-social-universidad-eafit | Comité de Acción Social, Universidad EAFIT | Medellín | Cancha, Placa Cubierta | — |
| corporacion-cultural-y-ambiental-suenos-de-nuevo-amanecer | Corporación Cultural y Ambiental Sueños de Nuevo Amanecer | Bogotá | Calle 57 B Sur # 86-46 | 4.64906, -74.0868005 |
| cruz-roja-alcaldia-de-sincelejo | Cruz Roja / Alcaldía de Sincelejo | Sincelejo | Calle 28 #25A-246 | 9.2994838, -75.3843651 |
| cruz-roja-barrancabermeja | Cruz Roja | Barrancabermeja | Calle 48 # 22-141 | 7.0566411, -73.8246964 |
| cruz-roja-bucaramanga | Cruz Roja | Bucaramanga | Calle 45 # 9B-10 | 7.1190593, -73.1103003 |
| cruz-roja-c-c-la-florida | Cruz Roja / C.C. La Florida | Floridablanca | Calle 31 # 26A-19 | 7.0790847, -73.0872838 |
| cruz-roja-cali | Cruz Roja | Cali | Carrera 38 Bis # 5-91 | 3.4235938, -76.5436446 |
| cruz-roja-cartagena | Cruz Roja | Cartagena | Calle 30 # 44D-71 | 10.3837085, -75.4681146 |
| cruz-roja-duitama | Cruz Roja | Duitama | Carrera 16 A # 10-26 | 5.8371365, -73.0186782 |
| cruz-roja-manizales | Cruz Roja | Manizales | Avenida Kevin Ángel - Carrera 21 # 63-350 | 5.0570114, -75.4825609 |
| cruz-roja-neomundo | Cruz Roja / Neomundo | Bucaramanga | Calle 89 Transversal Oriental Metropolitana # 69 | 7.0906723, -73.1126471 |
| cruz-roja-sogamoso | Cruz Roja | Sogamoso | Calle 11A # 8-46 | 5.72129, -72.9370609 |
| cruz-roja-villavicencio | Cruz Roja | Villavicencio | Calle 13 # 13-08 | 4.1280368, -73.6273082 |
| defensa-civil-colombiana | Defensa Civil Colombiana | Quibdó | Carrera 2 # 24-41 | 5.6903021, -76.6613401 |
| educambio-cali | Educambio | Cali | Carrera 24 # 5 Oeste - 25 | 3.4288453, -76.4653584 |
| el-bochinche-cafe | El Bochinche Café | Bogotá | Calle 22 # 1 - 26 | 4.604111, -74.0650416 |
| el-bourbon-estudio | El Bourbon Estudio | Bogotá | Calle 39 # 24-36 | 4.6269103, -74.0799538 |
| elpaisprimero-bogota-calle-39-sur | #ElPaísPrimero | Bogotá | Calle 39 Sur # 4-16 | 4.6394136, -74.168578 |
| elpaisprimero-bogota-calle-49-sur | #ElPaísPrimero | Bogotá | Calle 49 Sur # 27 - 47 | 4.636986, -74.181115 |
| elpaisprimero-bogota-carrera-69 | #ElPaísPrimero | Bogotá | Carrera 69 # 75-88 | 4.6730976, -74.0943325 |
| elpaisprimero-bogota-carrera-78 | #ElPaísPrimero | Bogotá | Carrera 78 # 38 C - 06 Sur | 4.6118745, -74.1612523 |
| elpaisprimero-bogota-transversal-17a | #ElPaísPrimero | Bogotá | Transversal 17A # 37-29 | 4.5937066, -74.0898699 |
| fulbright-colombia | Fulbright Colombia | Bogotá | Carrera 7 # 114-33 | 4.5573634, -74.1194576 |
| fundacion-acacia-de-vida-udea-medellin-calle-5b | Fundación Acacia de Vida / UdeA | Medellín | Calle 5B # 36B-36, apto 404 (Urb. Rincón de Castilla 1) | 6.2049972, -75.5682 |
| fundacion-acacia-de-vida-udea-medellin-cra-41 | Fundación Acacia de Vida / UdeA | Medellín | Cra 41 # 24-131 Apto 709 (Urb. California del Poblado) | 6.254924, -75.615727 |
| fundacion-acacia-de-vida-udea-medellin-km-8 | Fundación Acacia de Vida / UdeA | Medellín | Km 8, Urb. Haras Santa Lucía, Vía Llanogrande, Casa D28 | — |
| fundacion-acacia-de-vida-udea-medellin-via-carabanchel | Fundación Acacia de Vida / UdeA | Medellín | Vía Carabanchel – La María, Urb. La María, Casa 53 | — |
| fundacion-amigos-por-una-nueva-colombia-popayan | Fundación Amigos por una Nueva Colombia | Popayán | Carrera 6C # 31N-46. Salón Social - Guaduales de la Hacienda | 2.4581051, -76.5904481 |
| fundacion-arquidiocesana-banco-de-alimentos | Fundación Arquidiocesana Banco de Alimentos | Cali | Calle 24 # 6-103 | 3.4540001, -76.5203582 |
| fundacion-banco-arquidiocesano-de-alimentos-de-medellin | Fundación Banco Arquidiocesano de Alimentos de Medellín | Medellín | Carrera 52 # 30A - 97 | 6.2501537, -75.5696198 |
| fundacion-banco-nacoinal-de-sangre-hemolife | Fundación Banco Nacoinal de Sangre Hemolife | Bogotá | Calle 23 # 116-31 | 4.6697082, -74.1284874 |
| fundacion-cardio-infantil | Fundación Cardio Infantil | Bogotá | Carrera 13B # 161-85, Piso 2, Torre H | 4.5643683, -74.1261097 |
| fundacion-catalina-munoz-bogota-diagonal-48 | Fundación Catalina Muñoz | Bogotá | Diagonal 48 # 19-16 | 4.6728702, -74.1147666 |
| fundacion-catalina-munoz-bogota-diagonal-48-voluntariado | Fundación Catalina Muñoz | Bogotá | Diagonal 48 # 19-16 | 4.6728702, -74.1147666 |
| fundacion-galeria-aborigen-bogota | Fundación Galería Aborigen | Bogotá | Carrera 6A #116-17 | 4.6008594, -74.0731369 |
| fundacion-hematologica-colombiana-fuheco | Fundación Hematológica Colombiana - FUHECO | Bogotá | Carrera 65 # 81-67 | 4.5926295, -74.155883 |
| fundacion-hospital-de-la-misericordia | Fundación Hospital de la Misericordia | Bogotá | Av. Caracas # 1-65, piso 2 | 4.5710275, -74.1248053 |
| fundacion-hospital-infantil-universitario-de-san-jose | Fundación Hospital Infantil Universitario de San José | Bogotá | Carrera 52 # 67A-71 | 4.7183027, -74.0578205 |
| fundacion-karl-landsteiner-in-memoriam | Fundación Karl Landsteiner In Memoriam | Bogotá | Carrera 45A # 94-50 | 4.7217521, -74.0523031 |
| fundacion-saciar-medellin | Fundación Saciar | Medellín | Calle 50 # 25-261 | 6.2518521, -75.5725946 |
| fundacion-tierra-grata-cartagena-carrera-44d | Fundación Tierra Grata | Cartagena | Edificio Torre Mar de Luna - Carrera 44D # 30-42 | 10.4048154, -75.5114058 |
| fundacion-tierra-grata-cartagena-carrera-44d-voluntariado | Fundación Tierra Grata | Cartagena | Edificio Torre Mar de Luna - Carrera 44D # 30-42 | 10.4048154, -75.5114058 |
| fundacion-tierra-grata-cartagena-edificio-morros | Fundación Tierra Grata | Cartagena | Edificio Morros 1, al lado del Hotel Las Américas | — |
| fundacion-tierra-grata-cartagena-edificio-morros-voluntariado | Fundación Tierra Grata | Cartagena | Edificio Morros 1, al lado del Hotel Las Américas | — |
| fundacion-valle-de-lili-hospital-padrino-propacifico | Fundación Valle de Lili / Hospital Padrino / ProPacífico | Cali | Carrera 4 No. 22-07 | 3.4482619, -76.5446031 |
| fundacion-vuya-bogota-carrera-26 | Fundación Vuya | Bogotá | Carrera 26 #41A-04 Sur | 4.5890952, -74.1080504 |
| gimnasio-sport-center | Gimnasio Sport Center | Piedecuesta | Carrera 12 # 6-41 | 6.9886532, -73.0467325 |
| global-shapers-ideas-contra-el-odio-u-andes-calle-116 | Global Shapers / Ideas Contra el Odio / U. de los Andes | Bogotá | Calle 116 # 11C-22 | 4.7019522, -74.0820616 |
| global-shapers-ideas-contra-el-odio-u-andes-carrera-72 | Global Shapers / Ideas Contra el Odio / U. de los Andes | Bogotá | Carrera 72 # 17A-62. C.C. Multiplaza, Sótano 2 | 4.8144358, -74.0493124 |
| global-shapers-ideas-contra-el-odio-u-andes-royal-enfield | Global Shapers / Ideas Contra el Odio / U. de los Andes | Bogotá | Royal Enfield en la Zona T | — |
| global-shapers-ideas-contra-el-odio-u-andes-transversal-52c | Global Shapers / Ideas Contra el Odio / U. de los Andes | Bogotá | Transversal 52C # 2-46 | 4.6124791, -74.1190287 |
| gobernacion-del-choco-quibdo-calle-31 | Gobernación del Chocó | Quibdó | Calle 31 - Edificio La Confianza | 5.6945008, -76.6563461 |
| gobernacion-del-choco-quibdo-km-4 | Gobernación del Chocó | Quibdó | Km. 4 vía Quibdó-Yuto. Centro Logístico Humanitario | — |
| gobernacion-del-valle-del-cauca | Gobernación del Valle del Cauca | Cali | Carrera 1 # 26-85 | 3.4647843, -76.5149759 |
| hospital-central-policia-nacional | Hospital Central Policía Nacional | Bogotá | Carrera 59 # 26-24 (CAN) | 4.6466513, -74.0972733 |
| hospital-militar-central | Hospital Militar Central | Bogotá | Transversal 3 # 49-02, tercer piso sur | — |
| hospital-universitario-clinica-san-rafael | Hospital Universitario Clínica San Rafael | Bogotá | Carrera 8 # 17-44 Sur, piso 2 | 4.6493277, -74.0603519 |
| hospital-universitario-de-la-samaritana | Hospital Universitario de la Samaritana | Bogotá | Carrera 8 # 0-29 Sur | 4.5653099, -74.1018657 |
| hospital-universitario-del-valle-evaristo-garcia-e-s-e | Hospital Universitario del Valle Evaristo García E.S.E | Cali | Calle 5 # 36-08 | 3.446531, -76.5367174 |
| human-construction-bogota-carrera-52a | Human Construction | Bogotá | Carrera 52A # 134D-23 Local 1 | 4.5909088, -74.1361723 |
| human-construction-bogota-carrera-52a-voluntariado | Human Construction | Bogotá | Carrera 52A # 134-23, Local 1 | 4.5909088, -74.1361723 |
| iglesia-de-scientology | Iglesia de Scientology | Bogotá | Carrera 19 # 100-21 | 4.7858025, -74.0363339 |
| instituto-distrital-de-ciencia-biotecnologia-idcbis | IDCBIS | Bogotá | Carrera 32 # 12-81 | 4.5818332, -74.140216 |
| instituto-nacional-de-cancerologia | Instituto Nacional de Cancerología | Bogotá | Avenida 1 # 9-85 | — (Nominatim resolvía a Cúcuta; bloqueado por bbox) |
| la-facultad-del-rayon | La Facultad del Rayón | Bogotá | Carrera 19 # 43A-25 | 4.7858025, -74.0363339 |
| laika-mascotas-bogota-av-calle-116 | Laika (mascotas) | Bogotá | Av. Calle 116 # 18B-42 | 4.7009632, -74.0641162 |
| laika-mascotas-bogota-calle-94 | Laika (mascotas) | Bogotá | Calle 94 # 13-73 | 4.6823995, -74.0624851 |
| laika-mascotas-cali-calle-18 | Laika (mascotas) | Cali | Calle 18 # 1282 (Pance) | 3.3298351, -76.532872 |
| laika-mascotas-medellin-calle-2-sur | Laika (mascotas) | Medellín | Calle 2 Sur # 32-54 | 6.2045508, -75.5811778 |
| laika-mascotas-medellin-laika-llanogrande | Laika (mascotas) | Medellín | Laika Llanogrande | — |
| minuto-de-dios-barranquilla | Minuto de Dios | Barranquilla | Calle 73 # 7E (esquina) | 10.9513224, -74.8172179 |
| minuto-de-dios-bogota | Minuto de Dios | Bogotá | Transversal 73A # 82-61 (Banco de Ropas) | — |
| minuto-de-dios-cali | Minuto de Dios | Cali | Calle 5B # 37-120 | 3.3597222, -76.5459333 |
| minuto-de-dios-cartagena | Minuto de Dios | Cartagena | Carrera 15 # 31-110. C.C. San Lázaro, Local 19 | 10.5369529, -75.3961192 |
| minuto-de-dios-cucuta | Minuto de Dios | Cúcuta | Avenida 1E # 20-56 | 7.8856424, -72.4975054 |
| minuto-de-dios-medellin | Minuto de Dios | Medellín | Carrera 49 # 53-19, oficina 403 | 6.2491509, -75.5668261 |
| mujeres-por-la-democracia | Mujeres por la Democracia | Bogotá | Carrera 15 # 82-81 | 4.6553414, -74.0647214 |
| pan-y-pedazo | Pan y Pedazo | Medellín | Calle 41A # 70-44 | 6.2408971, -75.5680486 |
| parking-food-truck | Parking Food Truck | Pasto | Carrera 27 # 13-61 | 1.2093909, -77.2892002 |
| pastoral-social-de-medellin-calle-56 | Pastoral Social de Medellín | Medellín | Calle 56 # 43-24 | 6.2529427, -75.563124 |
| plataforma-municipal-de-juventud | Plataforma Municipal de Juventud | Pasto | Carrera 21A # 19-37 | 1.202151, -77.288287 |
| politecnico-grancolombiano-medellin-carrera-74 | Politécnico Grancolombiano | Medellín | Carrera 74 #52-20 | 6.259062, -75.5908443 |
| politecnico-grancolombiano-medellin-carrera-74-voluntariado | Politécnico Grancolombiano | Medellín | Carrera 74 # 52.20 | 6.259062, -75.5908443 |
| pontificia-universidad-javeriana-bogota-carrera-7 | Pontificia Universidad Javeriana | Bogotá | Carrera 7 # 40-62, edificios Emilio Arango… | 4.5573634, -74.1194576 |
| punto-de-captacion-cruz-roja | Punto de Captación Cruz Roja | Villavicencio | Carrera 30 # 39-30 | 4.1177541, -73.6263687 |
| reddhhpac-medellin | REDDHHPAC | Medellín | Carrera 79 # 52A-34 (Librería Rodante Delfos) | 6.245477, -75.599323 |
| reddhhpac-quibdo | REDDHHPAC | Quibdó | Calle 25 # 6-58 | 5.6893487, -76.6590759 |
| sociedad-de-cirugia-de-bogota-hospital-de-san-jose | Sociedad de Cirugía de Bogotá Hospital de San José | Bogotá | Calle 10 # 18-75 | 4.6560633, -74.1541833 |
| unicentro | Unicentro | Bogotá | Carrera 15 #124-30 | 4.5630771, -74.1307965 |
| universidad-de-los-andes | Universidad de los Andes | Bogotá | Carrera 1 Este # 18A-12 (edificios Mario Laserna…) | 4.5466543, -74.1000201 |
| varios-mosquera | Varios | Mosquera | JIT Logistics. Logika 13, Etapa 3, Bodega 5. Km 1.5 vía Bogotá-Mosquera | 4.6983995, -74.1794656 |
| vive-claro-distrito-cultural | Vive Claro Distrito Cultural | Bogotá | Av. La Esmeralda # 42-22 | 4.6658315, -74.085587 |

Además hay **2 sitios sin dirección** (`fundacion-udea` itinerante en Medellín, `hemocentro-del-cafe-y-tolima` en Manizales) y las convocatorias/campañas sin punto físico (por diseño, solo vista de lista).
