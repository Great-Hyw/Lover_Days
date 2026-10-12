package com.wei.Controller;


import com.wei.Result.result;
import com.wei.Service.PhotoService;
import com.wei.pojo.Photo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
public class PhotoController {
    @Autowired
    private PhotoService photoService;

    @PostMapping("/upload")
    public result Rupload(@RequestParam("file") MultipartFile file,@RequestParam("anniversaryId") Integer id) {


        Photo photo = photoService.upload(file,id);


        log.info("图片url" + photo);
        // 返回201状态码
        return result.success(photo);
    }


    @GetMapping("/photos")
    public result GetP(@RequestParam(required = false) Integer lastId) {


        Map<String,Object> p=new HashMap<>();

         List<Photo>photoList = photoService.getAll(lastId);
         if(photoList.isEmpty()){
             return result.success("目前还没图片");
         }
         p.put("list",photoList);
         if(photoList.size()<3){
             p.put("hashMore",false);
         }
         else {
             p.put("hasMore",true);
         }


        return result.success(p);
    }

    @DeleteMapping("/photos")
    public result Delete(@RequestBody Photo key) {

       Integer i= photoService.delete(key);

       if(i==0){
           return result.error("删除错误");
       }
        return result.success();
    }

}
