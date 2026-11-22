package com.wei.controller;


import com.wei.result.Result;
import com.wei.service.BirthdayService;
import com.wei.pojo.Birthday;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
public class BirthdayController {

   @Autowired
    private BirthdayService birthdayService;

   public Result getbirthdays(@RequestBody Birthday b){




    return Result.success();

    }






}
