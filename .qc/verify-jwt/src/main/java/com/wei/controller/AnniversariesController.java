package com.wei.controller;

import com.wei.result.Result;
import com.wei.service.AnniversariesService;
import com.wei.pojo.Anniversaries;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;


@RestController
@RequestMapping("/anniversaries")
@Slf4j
public class AnniversariesController {

    @Autowired
    private AnniversariesService ann;

    @PostMapping()
    public Result insertAnnersaries(@RequestBody Anniversaries a) {

        Integer i = ann.insertAnn(a);

        if (i <1) {//title重复
            return Result.error("title重复");
        }
        return Result.success(a);
    }

    /*
     *
     * 获取整个列表
     * */
    @GetMapping()
    public Result selectAnn() {

        List<Anniversaries> anniversaries = ann.Get();


        return Result.success(anniversaries);
    }

    /*
     *
     * 查询单个列表
     * */
    @GetMapping("/{id}")
    public Result GetAnn(@PathVariable Integer id) {

        Anniversaries a = ann.GetannID(id);


        return Result.success(a);
    }


    @PutMapping("/{id}")
    public Result updateAnn(@PathVariable Integer id , @RequestBody Anniversaries a ) {

        a.setId(id);

        Anniversaries b= ann.update(a);

        return Result.success(b);
    }

    @DeleteMapping("/{id}")
    public Result deleteAnn(@PathVariable Integer id){

        Object a=ann.delete(id);
        if(a==null){
            return Result.error("纪念日不存在",404);
        }

        return  Result.success();
    }

}
