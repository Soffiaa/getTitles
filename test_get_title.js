const fs = require('fs');
const path = require('path');
const r = require('./get_title');
const xlsx2json = require('xlsx2json');
// import XLSX from 'xlsx'
var XLSX = require('xlsx');

function getText(path) {
    let originalText = fs.readFileSync(path).toString();
    // console.log('rn', originalText.match(/\r\n/g).length);
    // console.log('nr', originalText.match(/\n\r/g).length);
    // let _text = originalText.replace(/\n\r/g, '###### ').replace(/\r\n/g, '******* ');
    // console.log(_text)
    // console.log(originalText.replace(/\r/g, '').split('\n').length);
    return originalText.replace(/\r/g, '');
}

getText('./puzzle/1-2519.txt');

function getArrText(text) {
    // let _text = text.trim().split('\n');
    let _text = text.split('\n');
    let processedText = _text.map((item, index) => {
        return item.trim() + '\n';
    });
    processedText.splice(-1, 1);//删掉最后一个无效项
    return processedText;
}

let regExpTitleLength;

//使用正则提取文本标题，并处理原文本，将两者处理成后续方便对比的结构
function processText(text) {
    let arrText = getArrText(text);
    let firstLine = arrText[ 0 ];
    let arrTitleResult = arrText.join('').match(r);
    //单独识别第一行是不是标题，因为我写不出这个正则
    if((/^[\S| ]{1,15}[  ]*\n/g).test(firstLine)){
        arrTitleResult.unshift(firstLine);
    }
    regExpTitleLength = arrTitleResult.length;
    // console.log('正则处理结果', arrTitleResult, 'length', arrTitleResult.length);
    let processedContent = [];
    let arrTextStartIndex = 0;
    for (let i = 0; i < arrTitleResult.length; i++) {
        for (let j = arrTextStartIndex; j < arrText.length; j++) {
            // if ((arrText[ j ] + '\n') == arrTitleResult[ i ]) {
            if ((arrText[ j ].trim()) == arrTitleResult[ i ].trim()) {
                processedContent.push({
                    lineNumber: j + 1,
                    content: arrTitleResult[ i ],
                    isTitle: true
                });
                //中断内层这个for循环，跳到外层for循环，并且内层for循环从上次的终点+1处开始
                arrTextStartIndex = j + 1;
                if (i !== arrTitleResult.length - 1) break;
            } else {
                processedContent.push({
                    lineNumber: j + 1,
                    content: arrText[ j ] + '\n',
                    isTitle: false
                });
                arrTextStartIndex = j + 1;
            }
        }
    }
    // console.log('原文本处理结果', (processedContent.length));
    return processedContent;
}

// var ttt = getText('./result/我的红黑时代.txt');
// var ttt = getText('./result/七里山塘风.txt');
// var ttt = getText('./result/test_text.txt');
// var ttt = getText('./result/2聪明的投资者.txt');
// var ttt = getText('./result/1宗教.txt');
// processText(ttt);

//提取并处理人工整理的标题结果
function processTrueTitles(text, trueTitleResultPath) {
    let arrText = getArrText(text);
    return new Promise((resolve, reject) => {
        let totalLines = arrText.length;
        let arrTrueTitleLineNum = [];
        xlsx2json(trueTitleResultPath).then(jsonArray => {
            for (let i = 0; i < jsonArray[ 0 ].length; i++) {
                arrTrueTitleLineNum.push(parseInt(jsonArray[ 0 ][ i ].A, 10));
            }
            arrTrueTitleLineNum = arrTrueTitleLineNum.sort((a, b) => a - b);
            // console.log('人工处理结果', arrTrueTitleLineNum, 'length', arrTrueTitleLineNum.length);
            //[ 1, 2, 4, 5, 9, 13, 17, 24, 32, 38, 48, 49, 57, 59, 67, 70 ]
            //现在需要将[ 1, 2, 4, 5, 9, 13]处理成如下格式
            //[{lineNumber:1,content:'xxx', isTitle:true},{lineNumber:2,content:'xxx', isTitle:true},{lineNumber:3,content:'xxx', isTitle:false},{lineNumber:4,content:'xxx', isTitle:true},{lineNumber:5,content:'xxx', isTitle:true},{lineNumber:6,content:'xxx', isTitle:false}...]
            let trueTitleLineNumIndex = 0;
            let trueTitleResult = [];
            for (let i = 1; i < totalLines + 1; i++) {
                if (i === arrTrueTitleLineNum[ trueTitleLineNumIndex ]) {
                    trueTitleResult.push({
                        lineNumber: i,
                        content: arrText[ i - 1 ],
                        isTitle: true
                    });
                    trueTitleLineNumIndex++;
                } else {
                    trueTitleResult.push({
                        lineNumber: i,
                        content: arrText[ i - 1 ],
                        isTitle: false
                    });
                }
            }
            // console.log('trueTitleResult',trueTitleResult);
            resolve({ trueTitleResult, trueTitleLength: arrTrueTitleLineNum.length });
        }).catch();
    });
}

let dataToExcel = [];

function calTitleRegExpValidityRate(textPath, trueTitleFilePath) {
    return new Promise((resolve, reject) => {
        let text = getText(textPath);
        // console.log('get text', text);
        let programResult = processText(text);
        let trueResult, validityRate1, validityRate;
        processTrueTitles(text, trueTitleFilePath).then(
            result => {
                let name = textPath.split('/')[ 2 ].split('.')[ 0 ];
                console.log(`<---------  ${name}  -------->`);
                console.log(`-> 原文处理结果行数： ${programResult.length}`);
                console.log(`-> 原文行数： ${getArrText(text).length}`);
                // let correctResultAmount1 = 0;
                let correctResultAmount = 0;
                let unMatchTitle = [];//人认为是，程序认为不是, 这种情况要尽量去完善正则
                let wrongResult = []; //程序认为是，人认为不是，这种情况主要以调整参数为主，比较难避免
                trueResult = result.trueTitleResult;
                //计算方法1
                //这个方法是不行的，当  正则与人工匹配的结果数量 ＞ 正则出来的结果，且正则出来的结果里包含了所有正确的结果（当然，还有错误的）时，这种计算方式得到的结果会是100%
                //正则匹配出来的结果，可能是都正确，与人工的结果完全匹配；
                // 也可能是数量多于人工的，且包含所有正确结果；
                // 也可能是多于人工的，但不包含所有正确结果；
                // 也可能是少于人工的，且包含所有正确结果；
                // 也可能是少于人工的，但不包含所有正确结果
                // if (trueResult.length === programResult.length) {
                //     for (let i = 0; i < programResult.length; i++) {
                //         // console.log(programResult[i].isTitle);
                //         // console.log(programResult[i].isTitle);
                //         if (programResult[ i ].isTitle === true && trueResult[ i ].isTitle === true) {
                //             correctResultAmount1++;
                //         } else if (programResult[ i ].isTitle === false && trueResult[ i ].isTitle === true) {
                //             unMatchTitle.push({
                //                 lineNumber: trueResult[ i ].lineNumber,
                //                 content: trueResult[ i ].content,
                //                 peopleConsiderItToBeATitle: trueResult[ i ].isTitle
                //             });
                //         }
                //     }
                //     // console.log('correctResultAmount1',correctResultAmount1);
                // } else {
                //     console.error(`!!!!!!!!!!!!!!统计出错：两份结果长度不一致↓↓↓\n程序处理结果长度为: ${programResult.length}\n人工处理的结果长度为: ${trueResult.length}`);
                // }
                // validityRate1 = `${correctResultAmount1 * 100 / result.trueTitleLength}%`;

                //计算方法2
                if (trueResult.length === programResult.length) {
                    for (let i = 0; i < programResult.length; i++) {
                        if (programResult[ i ].isTitle === trueResult[ i ].isTitle) {
                            correctResultAmount++;
                        } else if (programResult[ i ].isTitle === false && trueResult[ i ].isTitle === true) {
                            unMatchTitle.push({
                                lineNumber: trueResult[ i ].lineNumber,
                                content: trueResult[ i ].content,
                                peopleConsiderItToBeATitle: trueResult[ i ].isTitle
                            });
                        } else if (programResult[ i ].isTitle === true && trueResult[ i ].isTitle === false) {
                            wrongResult.push({
                                lineNumber: programResult[ i ].lineNumber,
                                content: programResult[ i ].content,
                                programConsiderItToBeATitle: programResult[ i ].isTitle
                            });
                        }
                    }
                    // console.log('correctResultAmount', correctResultAmount);
                } else {
                    console.error(`!!!!!!!!!!!!!!统计出错：两份结果长度不一致↓↓↓\n程序处理结果长度为: ${programResult.length}\n人工处理的结果长度为: ${trueResult.length}`);
                }
                let totalLines = getArrText(text).length;
                validityRate = `${correctResultAmount * 100 / totalLines}%`;
                // console.log(`------> validityRate1: ${validityRate1}`);
                console.log(`-> validityRate: ${validityRate}`);
                console.log(`-> unMatchTitleLength：${unMatchTitle.length}`);
                console.log(`-> wrongResultLength：${wrongResult.length}`);
                // console.log(`-> wrongResult：${JSON.stringify(wrongResult)}`);
                // console.log(`-> unMatchTitle：${JSON.stringify(unMatchTitle)}`);
                dataToExcel.push({
                    '名称': name,
                    '原文处理结果长度': programResult.length,
                    '原文行数': getArrText(text).length,
                    '标题识别正确率': validityRate,
                    '未匹配到的标题数量': unMatchTitle.length,
                    '未匹配到的标题':JSON.stringify(unMatchTitle),
                    '错误识别的标题数量': wrongResult.length,
                    '错误识别的标题':JSON.stringify(wrongResult),
                });
                resolve();
            }
        ).catch();
    });
}

// calTitleRegExpValidityRate('./result/test_text.txt', './result/test_text.xlsx');
// const directoryPath = './result';
const directoryPath = './result';
let filePathLists = [];
fs.readdirSync(directoryPath).forEach(file => {
    filePathLists.push({
        storyName: file.split('.')[ 0 ],
        filePath: `${directoryPath}/${file}`
    });
});

// console.log(filePathLists)
let index = 0;
let running_task_count = 0;
const MAX_TASK_COUNT = 5;

function calValidityRate(i) {
    running_task_count++;
    calTitleRegExpValidityRate(filePathLists[ i ].filePath, filePathLists[ i + 1 ].filePath).then(resp => {
        running_task_count--;
        if (i == filePathLists.length - 2) {
            console.log('------------------->    end   <---------------------');
            // let data = JSON.stringify(dataToExcel);
            // let data = [
            //     {
            //         '名称': '10-把时间当朋友',
            //         '原文处理结果长度': 1122,
            //         '原文行数': 1122,
            //         '标题识别正确率': '87.70053475935829%',
            //         '未匹配到的标题数量': 6,
            //         '错误识别的标题数量': 132
            //     },
            //     {
            //         '名称': '11-哺乳动物的时代',
            //         '原文处理结果长度': 843,
            //         '原文行数': 843,
            //         '标题识别正确率': '95.25504151838672%',
            //         '未匹配到的标题数量': 6,
            //         '错误识别的标题数量': 34
            //     },
            // ];

            /* 创建worksheet */
            let ws = XLSX.utils.json_to_sheet(dataToExcel);

            /* 新建空workbook，然后加入worksheet */
            var wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'result');

            /* 生成xlsx文件 */
            XLSX.writeFile(wb, '统计结果.xlsx');
            // var data = [
            //     {"name":"John", "city": "Seattle"},
            //     {"name":"Miiiike", "city": "Los Angeles"},
            //     {"name":"Zach", "city": "New York"}
            // ];
            //
            //
            // /* 创建worksheet */
            // var ws = XLSX.utils.json_to_sheet(data);
            //
            // /* 新建空workbook，然后加入worksheet */
            // var wb = XLSX.utils.book_new();
            // XLSX.utils.book_append_sheet(wb, ws, "People");
            //
            // /* 生成xlsx文件 */
            // XLSX.writeFile(wb, "sheetjs.xlsx");

        }
        if (running_task_count <= MAX_TASK_COUNT && index < filePathLists.length) {
            calValidityRate(index);
        }
    });
    index += 2;
    // console.log(index)
    if (running_task_count <= MAX_TASK_COUNT && index < filePathLists.length) {
        calValidityRate(index);
    }
}

// calTitleRegExpValidityRate(filePathLists[ 0 ].filePath, filePathLists[ 1 ].filePath).then(resp => {
//     console.log('hhh');
// });
//运行这个函数的时候，记得关掉result文件夹中的文件
calValidityRate(0);
//对结果的分析记得还要排除人工填写的误差（会有填错的）


