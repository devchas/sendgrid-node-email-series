var fs = require('fs');
fs.writeFile('/usr/src/app/hello.txt', "Hey there!", function(err) {
    if(err) {
        return console.log(err);
    }

    console.log("The file was saved!");
}); 
