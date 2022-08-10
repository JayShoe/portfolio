$(document).ready(function () {
    
    $('#country').change(function () {
        console.log($(this).val())
    })

    $('#escost2c').on('change', function () {
        getBlendedCost()
    })

    $('#escost1c').on('change', function () {
        getBlendedCost()
    })

    $('#escost5c').on('change', function () {
        getBlendedCost()
    })

    $('#escost25c').on('change', function () {
        getBlendedCost()
    })

    $('#peakdemgrowrt1').on('change', function () {
        getPCapYear2()
    })

    $('#energydemgrowrt1').on('change', function () {
        getECapYear2()
    })

    $('#inputpeak2').on('change', function () {
        getPRTYear1()
    })

    $('#inputenergy2').on('change', function () {
        getERTYear1()
    })

})

function getBlendedCost() {
    var x2c = Number($('#escost2c').val());
    var x1c = Number($('#escost1c').val());
    var x05c = Number($('#escost5c').val());
    var x025c = Number($('#escost25c').val());

    var y2c = x2c/10;
    var y1c = x1c/6;
    var y05c = x05c/4;
    var y025c = x025c/2;


    var blend = Number((y2c+y1c+y05c+y025c)/4).toFixed(0);
    $('#blended-cost').html(blend);

    console.log(blend)

    
}


function getPCapYear2() {
    var prt1 = Number($('#peakdemgrowrt1').val());
    var p1 = Number($('#inputpeak1').val());
    

    var PCap2 = Number(p1*(1+prt1/100)).toFixed(0);
    $('#inputpeak2').val(PCap2);
    
    console.log(PCap2)
    
        
}

function getECapYear2() {
    
    var ert1 = Number($('#energydemgrowrt1').val());
    var e1 = Number($('#inputenergy1').val());

  
    var ECap2 = Number(e1*(1+ert1/100)).toFixed(0);
    $('#inputenergy2').val(ECap2);

   
    console.log(ECap2)
    
    
}

function getPRTYear1() {
    var p2 = Number($('#inputpeak2').val());
    var p1 = Number($('#inputpeak1').val());

    var RT1 = Number((p2/p1-1)*100).toFixed(0);
    $('#peakdemgrowrt1').val(RT1);


    console.log(RT1)
    
}

function getERTYear1() {
   
    var e2 = Number($('#inputenergy2').val());
    var e1 = Number($('#inputenergy1').val());

  
    var RT2 = Number((e2/e1-1)*100).toFixed(0);
    $('#energydemgrowrt1').val(RT2);

    console.log(RT2)

}