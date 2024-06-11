import { ModelManager, ModelClient } from '@adobe/aem-spa-page-model-manager';
import 'zone.js/dist/zone-node';
import 'cross-fetch/polyfill';

import { ngExpressEngine } from '@nguniversal/express-engine';
import * as express from 'express';
import { join } from 'path';

import { AppServerModule } from './src/main.server';
import { existsSync } from 'fs';
import { environment } from './src/environments/environment';
import * as path from "path";
import { parse } from 'node-html-parser';

import 'isomorphic-fetch';

const APP_ROOT_PATH = environment.APP_ROOT_PATH;

// The Express app is exported so that it can be used by serverless Functions.
export function app() {
    const server = express();
    const distFolder =  path.resolve(__dirname, "../../dist");
    const indexHtml = existsSync(join(distFolder, 'index.original.html')) ? 'index.original.html' : 'index';
    const bodyParser = require('body-parser');

    // Our Universal express-engine (found @ https://github.com/angular/universal/tree/master/modules/express-engine)
    server.engine('html', ngExpressEngine({
        bootstrap: AppServerModule,
    }));

    server.set('view engine', 'html');
    server.set('views', distFolder);
    server.use(bodyParser.urlencoded({ extended: false }));
    server.use(bodyParser.json());

    // Example Express Rest API endpoints
    // server.get('/api/**', (req, res) => { });
    // Serve static files from /browser
    server.get('*.*', express.static(distFolder, {
        maxAge: '1y'
    }));

    const rootFolder = '/content/kansai';

    server.post([`${rootFolder}*.html`, '/conf/kansai/settings/wcm/templates*.html'], (req, res, next) => {

        const pageModelRootPath = req.headers['page-model-root-url'] || APP_ROOT_PATH;
        const model = req.body;

        ModelManager.initialize({ path: pageModelRootPath, model }).then(() => {

            res.render(indexHtml, { req } , (err, html) => {

                if(!!err){
                    next(err);
                }else{
                    const parsedHtml = parse(html);
                    const appElement = parsedHtml.querySelector('#spa-root');
                    let state = {
                        rootModel: model,
                        rootModelUrl: ModelManager.rootPath,
                    };
                    let stateStr = JSON.stringify(state);

                    const rendered = `${appElement.innerHTML}
                <script id="__AEM_STATE__" type="application/json">${stateStr}</script>`;
                    res.send(rendered);
                }

            });
        }).catch((error) => {
            console.error(error);
            //send error message back to response so AEM can log it.
            const msg = (error.stack) ? error + ' stack: ' + error.stack : error;
            res.status(500).send(msg);
        });
    });


    return server;
}

function run() {
    const port = process.env.PORT || 3233;

    // Start up the Node server
    const server = app();
    server.listen(port, () => {
        console.log(`Node Express server listening on http://localhost:${port}`);
    });
}

// Webpack will replace 'require' with '__webpack_require__'
// '__non_webpack_require__' is a proxy to Node 'require'
// The below code is to ensure that the server is run only when not requiring the bundle.
declare const __non_webpack_require__: NodeRequire;
const mainModule = __non_webpack_require__.main;
const moduleFilename = mainModule && mainModule.filename || '';
if (moduleFilename === __filename || moduleFilename.includes('iisnode')) {
    run();
}

export * from './src/main.server';
