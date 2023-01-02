import Router from '@koa/router'
import { Next } from 'koa'
import Jwt from 'jsonwebtoken'
import config from '../config/index.js'
import { AdminAccessLog, Admin } from '../orm/model.js'

export const responseTime = async (ctx: Router.RouterContext, next: Next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start
    ctx.set('X-Response-Time', `${ms}ms`);
    console.log('\x1b[32m%s\x1b[33m\t[%s]\x1b[32m[%sms]\x1b[0m -> \x1b[1;35m%s\x1b[0m', ctx.request.method, ctx.response.status, ms, ctx.request.URL)
}

export const cors = async (ctx: Router.RouterContext, next: Next) => {
    if (ctx.method !== 'OPTIONS') {
        await next()
    }else{
        ctx.status = 204;
    }
    ctx.set('Access-Control-Allow-Origin', '*')
    ctx.set('Access-Control-Allow-Methods', '*')
    ctx.set('Access-Control-Allow-Headers', '*')
}

export const auth = async (ctx: Router.RouterContext, next: Next) => {
    const token = ctx.request.header['x-token'] 
    if(typeof token !== 'string' || !token){
        ctx.status = 401, ctx.body = {'message':'请进行用户验证'}
        return
    }
    let adminInfo = null
    try {
        const payload = Jwt.verify(token, config.secret)
        adminInfo = await Admin.findByPk(Number(payload.sub))
        if(adminInfo === null){
            ctx.status = 401, ctx.body = {'message':'用户失效'}
            return
        }
        if(adminInfo.status == 0){
            ctx.status = 401, ctx.body = {'message':'用户禁止登录'}
            return
        }
        ctx.state = adminInfo
    } catch (error:any) {
        ctx.status = 401, ctx.body = {'message':'用户验证失败[' + error + ']'}
        return
    }
    await next()
    AdminAccessLog.create({
        admin: adminInfo.id,
        path:ctx.request.URL.pathname,
        method: ctx.request.method,
        ip:ctx.request.ip,
        payload: JSON.stringify(ctx.request.query) + JSON.stringify(ctx.request.body),
        status: ctx.response.status
    })
}
