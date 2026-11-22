package com.wei.Controller;

import com.wei.Result.result;
import com.wei.Service.anniversariesService;
import com.wei.pojo.anniversaries;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;


@RestController
@RequestMapping("/anniversaries")
@Slf4j
public class anniversariesController {

    @Autowired
    private anniversariesService ann;

    @PostMapping()
    public result insertAnnersaries(@RequestBody anniversaries a) {

        Integer i = ann.insertAnn(a);

        if (i <1) {//title重复
            return result.error("title重复");
        }
        return result.success(a);
    }

    /*
     *
     * 获取整个列表
     * */
    @GetMapping()
    public result selectAnn() {

        List<anniversaries> anniversaries = ann.Get();


        return result.success(anniversaries);
    }

    /*
     *
     * 查询单个列表
     * */
    @GetMapping("/{id}")
    public result GetAnn(@PathVariable Integer id) {

        anniversaries a = ann.GetannID(id);


        return result.success(a);
    }


    @PutMapping("/{id}")
    public result updateAnn(@PathVariable Integer id ,@RequestBody anniversaries a ) {

        a.setId(id);

        anniversaries b= ann.update(a);

        return result.success(b);
    }

    @DeleteMapping("/{id}")
    public result deleteAnn(@PathVariable Integer id){

        Object a=ann.delete(id);
        if(a==null){
            return result.TokenError("纪念日不存在");
        }

        return  result.success();
    }

}
