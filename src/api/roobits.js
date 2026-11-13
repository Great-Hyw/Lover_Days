import request from './request'


export function postRoobits(token){
     return request({
    url: '/auth/welcome',
    method: 'post',
    data:{
        rtoken:token
    }
  })
}
