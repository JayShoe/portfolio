
#include "ProductionCostThreadNoEss.h"

ProductionCostThreadNoEss::ProductionCostThreadNoEss(glpkLock *glpk, int identifierId, int row_id, DbConnector * database, QObject *parent) : QThread(parent) {
    this->database = database;
    identifier = QString("ProductionCostThread_").append(QString::number(identifierId));
    temp_row = row_id;
    this->glpk = glpk;
    this->row_id = &temp_row;
    QObject::connect(this, SIGNAL(_terminateThread()), this, SLOT(DeleteThread()), Qt::QueuedConnection);
}

ProductionCostThreadNoEss::~ProductionCostThreadNoEss() {
    qDebug() << this << " >> Deleting";
}

void ProductionCostThreadNoEss::run() {
    ProductionCost(*row_id, 1);

    emit _terminateThread();
    qDebug() << this << " Finished";

}

void ProductionCostThreadNoEss::DeleteThread() {
    this->exit();
    int count = 0;
    if (!this->wait(3000)) {
        this->terminate();
        this->wait();

    } else {
        this->deleteLater();
    }
}

int ProductionCostThreadNoEss::MonthForDay(int day) {
    if (day < 31) {
        return 1;
    } else if (day < 59) {
        return 2;
    } else if (day < 90) {
        return 3;
    } else if (day < 120) {
        return 4;
    } else if (day < 151) {
        return 5;
    } else if (day < 181) {
        return 6;
    } else if (day < 212) {
        return 7;
    } else if (day < 243) {
        return 8;
    } else if (day < 273) {
        return 9;
    } else if (day < 304) {
        return 10;
    } else if (day < 334) {
        return 11;
    } else {
        return 12;
    }
}

int ProductionCostThreadNoEss::HoursForDay(int day) {
    return day * 24;
}

int ProductionCostThreadNoEss::ProductionCost(int scenario_and_cases_row_id, int year) {
    qDebug() << this << " ProductionCostThreadNoEss Calculation started";
    double peakdemand1, peakdemand2 = 0, energydemand1 = 0, energydemand2 = 0;
    std::vector<double> demandprofile1, demandprofile2;
    double windfirmpower, solarfirmpower, windinvcost1, windinvcost2, solarinvcost1, solarinvcost2, windfixedOM, solarfixedOM, windVOM, solarVOM;
    std::vector<double> basewind, basesolar;
    double hydrocap1, hydrocap2, hydrores1, hydrores2, hydrores3, hydroinvcost1, hydroinvcost2, hydrovomcost, hydrofomcost, hydroramprate;
    double hydroEng1_1, hydroEng1_2, hydroEng1_3, hydroEng1_4, hydroEng1_5, hydroEng1_6, hydroEng1_7, hydroEng1_8, hydroEng1_9, hydroEng1_10, hydroEng1_11, hydroEng1_12, hydroEng2_1, hydroEng2_2, hydroEng2_3, hydroEng2_4, hydroEng2_5, hydroEng2_6, hydroEng2_7, hydroEng2_8, hydroEng2_9, hydroEng2_10, hydroEng2_11, hydroEng2_12;
    double capplan1, lostload1, primaryres1, secondres1, tertiaryres1;
    double windcappol1, windcappol2, solarcappol1, solarcappol2;
    double enercap_ds1, enercap_ds2, demrescap_ds1, demrescap_ds2, enercost_ds1, enercost_ds2, demrescost_ds1, demrescost_ds2, enerinv_ds1, enerinv_ds2, demresinv_ds1, demresinv_ds2, enermax_ds1, enermax_ds2, demresmax_ds1, demresmax_ds2, enersav_ds, demressav_ds, enerPRC_ds, enerSRC_ds, enerTRC_ds, demresPRC_ds, demresSRC_ds, demresTRC_ds, enerramprate_ds, demresramprate_ds;
    std::vector<double> chargeeff, dischargeeff, invcostpow1, invcostpow2, invcostener1, invcostener2, voms1, voms2, firmpow, fixedoms, eat1, eat2, mcd1, mcd2, enercap1, enercap2, powcap1, powcap2, esramprate, esduration, esenerarb1, esenerarb2, esmargcost;
    std::vector<std::string> stotype;
    std::vector<double> pconcap1, pconcap2, fuelprice1, fuelprice2, heatrate, vom, p_reserve, s_reserve, t_reserve, carbon_rate, invcost1, invcost2, fixedom, sumderate, winderate, convramprate;
    std::vector<std::string> thermtype;
    double discount_rate;
    int alt_an_years;
    //AA results
    std::vector<double> SolPR, SolPEE, SolPD, SolPS, SolPPeak, SolPH, SolES;

    double demres1, demres2, demres3, demres4, demres5, demres6, demres7, demres8, demres9, demres10, demres11, enereff1, enereff2, enereff3, enereff4, enereff5, enereff6, enereff7, enereff8, enereff9, enereff10, enereff11, demresramp;

    int col_count;
    sql::Connection *con = NULL;
    sql::Statement *stmt;
    sql::ResultSet *res;
    sql::ResultSetMetaData *res_meta;
    sql::PreparedStatement *pstmt;
    int count = 0;
    while (con == NULL) {
        if (count == 1) {
            count = 0;
            ThreadSleep(1000);
        }
        con = database->getProductionCostCon("irena_storage_benefits_tool", con);
        count++;
    }
    try {

        /* Select everything from table. */
        //Read calculation_settings_table
        pstmt = con->prepareStatement("SELECT * FROM calculation_settings_table WHERE scenario_and_cases_row_id = ?");
        qDebug() << "int " << scenario_and_cases_row_id;
        pstmt->setInt(1, scenario_and_cases_row_id);
        res = pstmt->executeQuery();

        while (res->next()) {
            alt_an_years = std::stoi(res->getString("alt_an_years")); //Convert string to int
            discount_rate = res->getDouble("discount_rate");
        }
        delete res;
        delete pstmt;
        //Read demand table
        qDebug() << this << " >> Query demand table";
        pstmt = con->prepareStatement("SELECT * FROM demand_table WHERE scenario_and_cases_row_id = ?");
        qDebug() << " int " << scenario_and_cases_row_id;
        pstmt->setInt(1, scenario_and_cases_row_id);
        res = pstmt->executeQuery();

        std::string temp, path, file_temp;
        while (res->next()) {

            file_temp = res->getString("userdemandprofile1");
            qDebug() << QString::fromStdString(file_temp);
            QFileInfo check_file(QString::fromStdString(file_temp));
            qDebug() << check_file.exists();
            QFile file(QString::fromStdString(file_temp));

            if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
                qDebug() << this << "Demand 1 File has not opend";
                std::string query3("UPDATE scenarios_and_cases SET production_cost_calculation_noess_status = 'ERROR in FILE'  WHERE row_id = ?;");
                pstmt = con->prepareStatement(query3);
                pstmt->setInt(1, scenario_and_cases_row_id);
                pstmt->execute();
                delete pstmt;
                delete con;
                return 1;
            } else
                qDebug() << this << "File Opened";

            QTextStream in(&file);
            while (!in.atEnd()) {
                QString line = in.readLine();
                demandprofile1.push_back(line.toDouble());
            }
            file_temp = res->getString("userdemandprofile2");
            QFile file2(QString::fromStdString(file_temp));
            if (!file2.open(QIODevice::ReadOnly | QIODevice::Text)) {
                qDebug() << this << "Demand 2 File has not opend";
                std::string query2("UPDATE scenarios_and_cases SET production_cost_calculation_noess_status  = 'ERROR in FILE' WHERE row_id = ?;");
                pstmt = con->prepareStatement(query2);
                pstmt->setInt(1, scenario_and_cases_row_id);
                pstmt->execute();
                delete pstmt;
                delete con;
                return 1;
            } else
                qDebug() << this << "File Opened";

            QTextStream in2(&file2);
            while (!in2.atEnd()) {
                QString line2 = in2.readLine();
                demandprofile2.push_back(line2.toDouble());
            }
            peakdemand1 = res->getDouble("peakdemand1");
            energydemand1 = res->getDouble("energydemand1");

        }
        delete res;
        delete pstmt;
        //Read Renewables table
        qDebug() << this << " >> Query generation_renewables_table";
        pstmt = con->prepareStatement("SELECT * FROM generation_renewables_table WHERE scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id));
        res = pstmt->executeQuery();
        //std::vector<double> enercap1,enercap2,powcap1,powcap2,chargeeff,dischargeeff,invcostpow1,invcostener1,invostpow2,invcostener2,vom1,vom2,firmpow,fixedom,EAT,MDC;
        while (res->next()) {
            std::string file_temp;
            file_temp = res->getString("userbasewind1");
            QFile file3(QString::fromStdString(file_temp));
            if (!file3.open(QIODevice::ReadOnly | QIODevice::Text)) {
                qDebug() << this << "Wind File has not opend";
                std::string query2("UPDATE scenarios_and_cases SET production_cost_calculation_noess_status = 'ERROR in FILE' WHERE row_id = ?;");
                pstmt = con->prepareStatement(query2);
                pstmt->setInt(1, scenario_and_cases_row_id);
                pstmt->execute();
                delete pstmt;
                delete con;
                return 1;
            } else
                qDebug() << this << "File Opened";

            QTextStream in3(&file3);
            while (!in3.atEnd()) {
                QString line3 = in3.readLine();
                basewind.push_back(line3.toDouble());
            }
            file_temp = res->getString("userbasesolar1");
            QFile file4(QString::fromStdString(file_temp));
            if (!file4.open(QIODevice::ReadOnly | QIODevice::Text)) {
                qDebug() << this << "Solar File has not opend";
                std::string query2("UPDATE scenarios_and_cases SET production_cost_calculation_noess_status = 'ERROR in FILE WHERE row_id = ?;");
                pstmt = con->prepareStatement(query2);
                pstmt->setInt(1, scenario_and_cases_row_id);
                pstmt->execute();
                delete pstmt;
                delete con;
                return 1;
            } else
                qDebug() << this << "File Opened";

            QTextStream in4(&file4);
            while (!in4.atEnd()) {
                QString line4 = in4.readLine();
                basesolar.push_back(line4.toDouble());
            }

            windfirmpower = res->getDouble("windfirmpower");
            solarfirmpower = res->getDouble("solarfirmpower");
            windinvcost1 = res->getDouble("windinvcost1");
            windinvcost2 = res->getDouble("windinvcost2");
            solarinvcost1 = res->getDouble("solarinvcost1");
            solarinvcost2 = res->getDouble("solarinvcost2");
            windfixedOM = res->getDouble("windfixedOM");
            solarfixedOM = res->getDouble("solarfixedOM");
            windVOM = 0.0; //res->getDouble("windVOM");
            solarVOM = 0.0; //res->getDouble("solarVOM");
        }

        delete res;
        delete pstmt;
        //Read Hydro table
        qDebug() << this << " >> Query generation_hydro_table";
        pstmt = con->prepareStatement("SELECT * FROM generation_hydro_table WHERE scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id));
        res = pstmt->executeQuery();
        res_meta = res->getMetaData();
        col_count = res_meta->getColumnCount();
        while (res->next()) {
            hydrocap1 = res->getDouble("hydrocap" + std::to_string(year));
            hydrores1 = res->getDouble("hydrores1");
            hydrores2 = res->getDouble("hydrores2");
            hydrores3 = res->getDouble("hydrores3");
            hydroinvcost1 = res->getDouble("hydroinvcost1");
            hydroinvcost2 = res->getDouble("hydroinvcost2");
            hydrofomcost = res->getDouble("hydrofomcost");
            hydrovomcost = res->getDouble("hydrovomcost");
        }
        delete res;
        delete pstmt;
        //Read Hydro energy table
        qDebug() << this << " >> Query hydro_monthly_energy_table";
        pstmt = con->prepareStatement("SELECT * FROM hydro_monthly_energy_table WHERE scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id));
        res = pstmt->executeQuery();
        while (res->next()) {
            hydroEng1_1 = res->getDouble("hydroEng" + std::to_string(year) + "_1");
            hydroEng1_2 = res->getDouble("hydroEng" + std::to_string(year) + "_2");
            hydroEng1_3 = res->getDouble("hydroEng" + std::to_string(year) + "_3");
            hydroEng1_4 = res->getDouble("hydroEng" + std::to_string(year) + "_4");
            hydroEng1_5 = res->getDouble("hydroEng" + std::to_string(year) + "_5");
            hydroEng1_6 = res->getDouble("hydroEng" + std::to_string(year) + "_6");
            hydroEng1_7 = res->getDouble("hydroEng" + std::to_string(year) + "_7");
            hydroEng1_8 = res->getDouble("hydroEng" + std::to_string(year) + "_8");
            hydroEng1_9 = res->getDouble("hydroEng" + std::to_string(year) + "_9");
            hydroEng1_10 = res->getDouble("hydroEng" + std::to_string(year) + "_10");
            hydroEng1_11 = res->getDouble("hydroEng" + std::to_string(year) + "_11");
            hydroEng1_12 = res->getDouble("hydroEng" + std::to_string(year) + "_12");
        }
        delete res;
        delete pstmt;
        //Read Planning criteria table
        qDebug() << this << " >> Query programs_planning_criteria_table";
        pstmt = con->prepareStatement("SELECT * FROM programs_planning_criteria_table WHERE scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id));
        res = pstmt->executeQuery();
        res_meta = res->getMetaData();
        col_count = res_meta->getColumnCount();
        while (res->next()) {
            capplan1 = res->getDouble("capplan1");
            lostload1 = res->getDouble("lostload1");
            primaryres1 = res->getDouble("primaryres1");
            secondres1 = res->getDouble("secondres1");
            tertiaryres1 = res->getDouble("tertiaryres1");
        }
        delete res;
        delete pstmt;
        //Read Demand side programme table
        qDebug() << this << " >> Query programs_demand_side_table";
        pstmt = con->prepareStatement("SELECT * FROM programs_demand_side_table WHERE scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id));
        res = pstmt->executeQuery();
        res_meta = res->getMetaData();
        col_count = res_meta->getColumnCount();
        while (res->next()) {
            enercap_ds1 = res->getDouble("enercap_ds1");
            enercap_ds2 = res->getDouble("enercap_ds2");
            demrescap_ds1 = res->getDouble("demrescap_ds1");
            demrescap_ds2 = res->getDouble("demrescap_ds2");
            enercost_ds1 = res->getDouble("enercost_ds1");
            enercost_ds2 = res->getDouble("enercost_ds2");
            demrescost_ds1 = res->getDouble("demrescost_ds1");
            demrescost_ds2 = res->getDouble("demrescost_ds2");
            enerinv_ds1 = res->getDouble("enerinv_ds1");
            enerinv_ds2 = res->getDouble("enerinv_ds2");
            demresinv_ds1 = res->getDouble("demresinv_ds1");
            demresinv_ds2 = res->getDouble("demresinv_ds2");
            enermax_ds1 = res->getDouble("enermax_ds1");
            enermax_ds2 = res->getDouble("enermax_ds2");
            demresmax_ds1 = res->getDouble("demresmax_ds1");
            demresmax_ds2 = res->getDouble("demresmax_ds2");
            enersav_ds = res->getDouble("enersav_ds");
            demressav_ds = res->getDouble("demressav_ds");
            enerPRC_ds = res->getDouble("enerPRC_ds");
            enerSRC_ds = res->getDouble("enerSRC_ds");
            enerTRC_ds = res->getDouble("enerTRC_ds");
            demresPRC_ds = res->getDouble("demresPRC_ds");
            demresSRC_ds = res->getDouble("demresSRC_ds");
            demresTRC_ds = res->getDouble("demresTRC_ds");
            enerramprate_ds = res->getDouble("enerramprate_ds");
            demresramprate_ds = res->getDouble("demresramprate_ds");


        }
        delete res;
        delete pstmt;
        //Read energy storage dynamic table
        qDebug() << this << " >> Query energy_storage_dynamic_table";
        pstmt = con->prepareStatement("SELECT * FROM energy_storage_dynamic_table WHERE scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id));
        res = pstmt->executeQuery();

        while (res->next()) {
            chargeeff.push_back(res->getDouble("chargeeff"));
            dischargeeff.push_back(res->getDouble("dischargeeff"));
            enercap1.push_back(res->getDouble("enercap1"));
            enercap2.push_back(res->getDouble("enercap2"));
            powcap1.push_back(res->getDouble("powcap1"));
            powcap2.push_back(res->getDouble("powcap2"));
            esramprate.push_back(res->getDouble("esramprate"));
            esduration.push_back(res->getDouble("esduration"));
            stotype.push_back(res->getString("storage_options"));
        }
        delete res;
        delete pstmt;
        //Read energy storage cost dynamic table
        qDebug() << this << " >> Query energy_storage_cost_dynamic_table";
        pstmt = con->prepareStatement("SELECT * FROM energy_storage_cost_dynamic_table WHERE scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id));
        res = pstmt->executeQuery();

        while (res->next()) {
            invcostpow1.push_back(res->getDouble("invcostpow1"));
            invcostpow2.push_back(res->getDouble("invcostpow2"));
            invcostener1.push_back(res->getDouble("invcostener1"));
            invcostener2.push_back(res->getDouble("invcostener2"));
            voms1.push_back(res->getDouble("vom1"));
            voms2.push_back(res->getDouble("vom2"));
            firmpow.push_back(res->getDouble("firmpow"));
            fixedoms.push_back((res->getDouble("esfixedom")*1000));
            eat1.push_back(res->getDouble("esenerarb1"));
            eat1.push_back(res->getDouble("esenerarb2"));
            mcd1.push_back(res->getDouble("esmargcost1"));
            mcd1.push_back(res->getDouble("esmargcost2"));
        }
        delete res;
        delete pstmt;
        //Read fuelprice forecast table
        qDebug() << this << " >> Query fuel_price_forecast_table";
        pstmt = con->prepareStatement("SELECT * FROM fuel_price_forecast_table WHERE scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id));
        res = pstmt->executeQuery();

        while (res->next()) {
            fuelprice1.push_back(res->getDouble("fuelprice1"));
            fuelprice2.push_back(res->getDouble("fuelprice2"));
        }
        delete pstmt;
        delete res;
        //Read conventional generation dynamic table
        qDebug() << this << " >> Query generation_conventional_table";
        pstmt = con->prepareStatement("SELECT * FROM generation_conventional_table WHERE scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id));
        res = pstmt->executeQuery();

        while (res->next()) {
            pconcap1.push_back(res->getDouble("pconcap1"));
            pconcap2.push_back(res->getDouble("pconcap2"));
            heatrate.push_back(res->getDouble("heatrate"));
            p_reserve.push_back(res->getDouble("p_reserve"));
            s_reserve.push_back(res->getDouble("s_reserve"));
            t_reserve.push_back(res->getDouble("t_reserve"));
            carbon_rate.push_back(res->getDouble("carbon_rate"));
            sumderate.push_back(res->getDouble("sumderate"));
            winderate.push_back(res->getDouble("winderate"));
            convramprate.push_back(res->getDouble("convramprate"));
            thermtype.push_back(res->getString("fuel_options"));
        }
        //Read tech capital dynamic table
        qDebug() << this << " >> Query tech_capital_dynamic_table";
        pstmt = con->prepareStatement("SELECT * FROM tech_capital_dynamic_table WHERE scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id));
        res = pstmt->executeQuery();
        while (res->next()) {
            fixedom.push_back((res->getDouble("fixedom")*1000));
            vom.push_back(res->getDouble("vom"));
            invcost1.push_back(res->getDouble("invcost1"));
            invcost2.push_back(res->getDouble("invcost2"));
        }
        //Read installed ESS power capacity
        qDebug() << this << " >> Query installed_capacity_output_noess_cap_tables";
        pstmt = con->prepareStatement("SELECT * FROM installed_capacity_output_noess_cap_tables WHERE scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id));
        res = pstmt->executeQuery();
        while (res->next()) {
            SolPS.push_back(res->getDouble("outinst" + std::to_string(year)));
        }
        delete res;
        delete pstmt;
        for (int i = 0; i < SolPS.size(); i++) {
            qDebug() << "ES power investment: " << SolPS[i];
        }
        //Read demand side installed capacity
        qDebug() << this << " >> Query demand_side_output_installed_cap_noess_tables";
        pstmt = con->prepareStatement("SELECT * FROM demand_side_output_installed_cap_noess_tables WHERE scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id));
        res = pstmt->executeQuery();
        delete pstmt;
        while (res->next()) {
            SolPEE.push_back(res->getDouble("outeff" + std::to_string(year)));
            SolPD.push_back(res->getDouble("outdem" + std::to_string(year)));
        }
        delete res;
        //        for (int i = 0; i < SolPEE.size(); i++){
        //            qDebug() << "EE investment: " << SolPEE[i];
        //            qDebug() << "DR investment: " << SolPD[i];
        //        }
        //Read ESS installed energy capacity
        qDebug() << this << " >> Query energy_capacity_output_noess_cap_tables";
        pstmt = con->prepareStatement("SELECT * FROM energy_capacity_output_noess_cap_tables WHERE scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id));
        res = pstmt->executeQuery();
        while (res->next()) {
            SolES.push_back(res->getDouble("outener" + std::to_string(year)));
        }
        delete res;
        delete pstmt;
        //        for (int i = 0; i < SolES.size(); i++){
        //            qDebug() << "ES energy investment: " << SolPS[i];
        //        }
        //Read hydro dam installed capacity
        qDebug() << this << " >> Query hydro_generation_output_installed_cap_noess_tables";
        pstmt = con->prepareStatement("SELECT * FROM hydro_generation_output_installed_cap_noess_tables WHERE scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id));
        res = pstmt->executeQuery();
        while (res->next()) {
            SolPH.push_back(res->getDouble("outdam" + std::to_string(year)));
        }
        delete res;
        delete pstmt;
        //        for (int i = 0; i < SolPH.size(); i++){
        //            qDebug() << "Hyd investment: " << SolPH[i];
        //        }
        //Read Thermal installed capacity
        qDebug() << this << " >> Query thermal_generation_output_installed_cap_noess_tables";
        pstmt = con->prepareStatement("SELECT * FROM thermal_generation_output_installed_cap_noess_tables WHERE scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id));
        res = pstmt->executeQuery();
        while (res->next()) {
            SolPPeak.push_back(res->getDouble("outthermgen" + std::to_string(year)));
        }
        delete res;
        delete pstmt;
        //        for (int i = 0; i < SolPPeak.size(); i++){
        //            qDebug() << "Thermal investment: " << SolPPeak[i];
        //        }
        //Read installed renewable capacity
        qDebug() << this << " >> Query renewables_output_installed_cap_noess_table";
        pstmt = con->prepareStatement("SELECT * FROM renewables_output_installed_cap_noess_table WHERE scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id));
        res = pstmt->executeQuery();
        while (res->next()) {
            SolPR.push_back(res->getDouble("outwind" + std::to_string(year)));
            SolPR.push_back(res->getDouble("outsolarpv" + std::to_string(year)));
        }
        delete res;
        delete pstmt;
        for (int i = 0; i < SolPR.size(); i++) {
            qDebug() << "Ren investment: " << SolPR[i];
        }
    } catch (sql::SQLException &e) {
        std::cout << "# ERR: SQLException in " << __FILE__;
        std::cout << "(" << __FUNCTION__ << ") on line " << __LINE__ << std::endl;
        std::cout << "# ERR: " << e.what();
        std::cout << " (MySQL error code: " << e.getErrorCode();
        std::cout << ", SQLState: " << e.getSQLState() << " )" << std::endl;
        std::string query2("UPDATE scenarios_and_cases SET production_cost_calculation_status = 'ERROR_QUERY', production_cost_calculation_date =CURRENT_TIMESTAMP() WHERE row_id = ?;");
        pstmt = con->prepareStatement(query2);
        pstmt->setInt(1, scenario_and_cases_row_id);
        pstmt->execute();
        delete pstmt;
        delete con;

        return 0;
    }

    std::vector<double> not_normal, not_normal_status;

    PC_inputs ProdCostIn;
    ProdCostIn.common_data.NGen = invcost1.size();
    ProdCostIn.common_data.NGenE = 0;
    ProdCostIn.common_data.NEE = 1;
    ProdCostIn.common_data.ND = 1;
    ProdCostIn.common_data.NR = 2;
    ProdCostIn.common_data.NHyd = 1;
    ProdCostIn.common_data.NS = 4;
    ProdCostIn.common_data.demand = demandprofile1;
    std::cout << ProdCostIn.common_data.demand.size() << std::endl;
    ProdCostIn.common_data.Pl = pconcap1;
    ProdCostIn.common_data.Ph = {hydrocap1};
    ProdCostIn.common_data.Ad = {demres5};
    ProdCostIn.common_data.Aee = {enereff5};
    ProdCostIn.common_data.Ah = {hydroinvcost1};
    ProdCostIn.common_data.Ai = invcost1;
    ProdCostIn.common_data.FOM = fixedom;
    ProdCostIn.common_data.Ar = {windinvcost1, solarinvcost1}; //windinvcost2,solarinvcost2
    ProdCostIn.common_data.FOMr = {windfixedOM * 1000, solarfixedOM * 1000};
    ProdCostIn.common_data.VOMr = {windVOM, solarVOM};
    ProdCostIn.common_data.As = invcostpow1;
    ProdCostIn.common_data.Duration = {0.5, 1, 2, 4};
    ProdCostIn.common_data.EAT = {200000, 300000, 400000, 500000};
    ProdCostIn.common_data.ETACs = chargeeff;
    ProdCostIn.common_data.ETADs = dischargeeff;
    ProdCostIn.common_data.Emissions = carbon_rate;
    ProdCostIn.common_data.FOMs = fixedoms;
    ProdCostIn.common_data.FPh = {0.8};
    ProdCostIn.common_data.FPr = {windfirmpower, solarfirmpower};
    ProdCostIn.common_data.FPs = firmpow;
    ProdCostIn.common_data.Fee = {enersav_ds/100};
    ProdCostIn.common_data.FuelCost = fuelprice1;
    ProdCostIn.common_data.Heat_Rates = heatrate;
    ProdCostIn.common_data.MCD = {150000, 150000, 150000, 150000};
    //ProdCostIn.common_data.PResC = p_reserve;
    ProdCostIn.common_data.PResCh = {hydrores1};
    ProdCostIn.common_data.FOMh = {hydrofomcost * 1000};
    ProdCostIn.common_data.VOMh = {hydrovomcost};
    ProdCostIn.common_data.PResCs = {0, 0, 0, 0};
    ProdCostIn.common_data.PeeM = {enermax_ds1};
    ProdCostIn.common_data.RCs = invcostener1;
    ProdCostIn.common_data.ReserveDuration = {0.25, 0.5, 1};
    ProdCostIn.common_data.ReserveRequirements = {primaryres1, secondres1, tertiaryres1};
    ProdCostIn.common_data.ResourceH = {hydroEng1_1*1000, hydroEng1_2*1000, hydroEng1_3*1000, hydroEng1_4*1000, hydroEng1_5*1000, hydroEng1_6*1000, hydroEng1_7*1000, hydroEng1_8*1000, hydroEng1_9*1000, hydroEng1_10*1000, hydroEng1_11*1000, hydroEng1_12*1000};
    for (int t = 0; t < basewind.size(); t++) {
        ProdCostIn.common_data.ResourceR.push_back(basewind[t]);
    }
    for (int t = 0; t < basesolar.size(); t++) {
        ProdCostIn.common_data.ResourceR.push_back(basesolar[t]);
    }
    //ProdCostIn.common_data.SResC = s_reserve;
    ProdCostIn.common_data.SResCh = {hydrores2};
    ProdCostIn.common_data.SResCs = {0, 0, 0, 0};
    ProdCostIn.common_data.SafetyFactor = capplan1;
    //ProdCostIn.common_data.DiscountRate = discount_rate/100;
    //ProdCostIn.common_data.TResC = t_reserve;
    ProdCostIn.common_data.TResCh = {0};
    ProdCostIn.common_data.TResCs = {hydrores3};
    ProdCostIn.common_data.VCd = {demres3};
    ProdCostIn.common_data.VOM = vom;
    ProdCostIn.common_data.VOMs = voms1;
    ProdCostIn.SolEs = SolES;
    ProdCostIn.SolPd = SolPD;
    ProdCostIn.SolPee = SolPEE;
    ProdCostIn.SolPh = SolPH;
    ProdCostIn.SolPpeak = SolPPeak;
    ProdCostIn.SolPs = SolPS;
    ProdCostIn.SolPr = SolPR;


    const int NGen = ProdCostIn.common_data.NGen; //Number of peaking generators
    int NH = 24; //Number of hours
    const int NHyd = ProdCostIn.common_data.NHyd; //Number of hydro generators
    const int NEE = ProdCostIn.common_data.NEE; //Energy efficiency measures
    const int ND = ProdCostIn.common_data.ND; //Demand response technologies
    const int NR = ProdCostIn.common_data.NR; //Renewable Sources
    const int NS = ProdCostIn.common_data.NS; //Storage Technologies
    int NUMBER_OF_DAYS = 365;
    for (int i = 0; i < NGen; i++) {
        ProdCostIn.common_data.PResC.push_back(5 * (i + 1));
        ProdCostIn.common_data.SResC.push_back(5 * (i + 1));
        ProdCostIn.common_data.TResC.push_back(5 * (i + 1));
    }
    qDebug() << "NGen: " << NGen << ", NHyd: " << NHyd << ", NEE: " << NEE << ", ND: " << ND << ", NR: " << NR << ", NS: " << NS;
    const int DaysperMonth[12] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
    std::vector<double> HoursperMonth;
    HoursperMonth.reserve(12);
    int HoursLimits[13] = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
    for (int i = 0; i < 12; i++) {
        HoursperMonth[i] = 24 * DaysperMonth[i];
    }
    for (int i = 1; i < 13; i++) {
        for (int j = 0; j < i; j++) {
            HoursLimits[i] = HoursLimits[i] + HoursperMonth[j];
        }
    }

    //Demand scaling
    double scalar1;
    double energy1 = std::accumulate(demandprofile1.begin(), demandprofile1.end(), 0.0);
    double peak1 = *std::max_element(demandprofile1.begin(), demandprofile1.end());
    scalar1 = (energydemand1 * 1000 - peakdemand1) / (energy1 - peak1);
    for (int i = 0; i < demandprofile1.size(); i++) {
        demandprofile1[i] = demandprofile1[i] * scalar1;
    }
    //Energy Efficiency
    std::vector<double> saving_factor;
    for (int i = 0; i < NEE; i++) {
        saving_factor.push_back(ProdCostIn.common_data.Fee[i] * ProdCostIn.SolPee[i] / ProdCostIn.common_data.PeeM[i]);
    }
    double total_sf = std::accumulate(saving_factor.begin(), saving_factor.end(), 0.0);
    /*
    for (int i=0; i< demandprofile1.size();i++)
    {
      demandprofile[i]= demandprofile1[i] *( 1 - total_sf);
    }
     */
    for (int i = 0; i < demandprofile1.size(); i++) {
        demandprofile1[i] = demandprofile1[i]*(1 - total_sf);
    }
    double max_demand = *std::max_element(demandprofile1.begin(), demandprofile1.end());
    qDebug() << "Maximum demand is: " << max_demand;
    double installed_capacity = std::accumulate(ProdCostIn.SolPd.begin(), ProdCostIn.SolPd.end(), 0.0) + std::accumulate(ProdCostIn.SolPr.begin(), ProdCostIn.SolPr.end(), 0.0) + std::accumulate(ProdCostIn.SolPs.begin(), ProdCostIn.SolPs.end(), 0.0) + std::accumulate(ProdCostIn.SolPh.begin(), ProdCostIn.SolPh.end(), 0.0) + std::accumulate(ProdCostIn.SolPpeak.begin(), ProdCostIn.SolPpeak.end(), 0.0);
    qDebug() << "System capacity is: " << installed_capacity;

    PC_outputs results;
    results.energyPrice = new double[8760];
    results.RP_price = new double[8760];
    results.RS_price = new double[8760];
    results.RT_price = new double[8760];
    //Input data conversion
    std::vector<double> VCi;
    VCi.reserve(NGen); //Variable costs of thermal generators ($/MWh);
    std::vector<double> EmissionFactor;
    EmissionFactor.reserve(NGen); //Emissions Cost($/MWh)

    for (int i = 0; i < NGen; i++) {
        VCi[i] = ProdCostIn.common_data.FuelCost[i] * ProdCostIn.common_data.Heat_Rates[i] + ProdCostIn.common_data.VOM[i] + ProdCostIn.common_data.Emissions[i] * ProdCostIn.common_data.Heat_Rates[i] * ProdCostIn.common_data.CarbonPrice;
        EmissionFactor[i] = ProdCostIn.common_data.Emissions[i] * ProdCostIn.common_data.Heat_Rates[i] * ProdCostIn.common_data.CarbonPrice;
    }
    std::vector<double> VCF;
    VCF.reserve(NH * (NGen));
    for (int i = 0; i < (NGen); i++) {
        for (int t = 0; t < NH; t++) {
            VCF[NH * i + t] = VCi[i];
        }
    }
    double* PRCost = new double[NH * (NGen)];
    double *SRCost = new double[NH * (NGen)];
    double *TRCost = new double[NH * (NGen)];

    for (int i = 0; i < (NGen); i++) {
        for (int t = 0; t < NH; t++) {
            PRCost[NH * i + t] = ProdCostIn.common_data.PResC[i];
            SRCost[NH * i + t] = ProdCostIn.common_data.SResC[i];
            TRCost[NH * i + t] = ProdCostIn.common_data.TResC[i];
        }
    }
    double * VCDF = new double[ND * NH];
    for (int i = 0; i < ND; i++) {
        for (int t = 0; t < NH; t++) {
            VCDF[NH * i + t] = ProdCostIn.common_data.VCd[i];
        }
    }
    double *VCRF = new double[NR * NH];
    for (int i = 0; i < NR; i++) {
        for (int t = 0; t < NH; t++) {
            VCRF[NH * i + t] = 0;
        }
    }
    double *VCHF = new double[NHyd * NH];

    for (int i = 0; i < NHyd; i++) {
        for (int t = 0; t < NH; t++) {
            VCHF[NH * i + t] = ProdCostIn.common_data.VOMh[i];
        }
    }
    double * PRCostHyd = new double[NHyd * NH];
    double *SRCostHyd = new double[NHyd * NH];
    double *TRCostHyd = new double[NHyd * NH];
    for (int i = 0; i < NHyd; i++) {
        for (int t = 0; t < NH; t++) {
            PRCostHyd[NH * i + t] = ProdCostIn.common_data.PResCh[i];
            SRCostHyd[NH * i + t] = ProdCostIn.common_data.SResCh[i];
            TRCostHyd[NH * i + t] = ProdCostIn.common_data.TResCh[i];
        }
    }
    double *VCSF = new double[NS * NH];

    for (int i = 0; i < NS; i++) {
        for (int t = 0; t < NH; t++) {
            VCSF[NH * i + t] = ProdCostIn.common_data.VOMs[i];
        }
    }

    //    std::vector<double> PRCosts, SRCosts, TRCosts;
    //    PRCosts.reserve(NS * NH);
    //    SRCosts.reserve(NS * NH);
    //    TRCosts.reserve(NH * NS);
    //    for (int i = 0; i < NS; i++) {
    //        for (int t = 0; t < NH; t++) {
    //            PRCosts[NH * i + t] = ProdCostIn.common_data.PResCs[i];
    //            SRCosts[NH * i + t] = ProdCostIn.common_data.SResCs[i];
    //            TRCosts[NH * i + t] = ProdCostIn.common_data.TResCs[i];
    //        }
    //    }
    //    std::vector<double> VCSEF;
    //    VCSEF.reserve(NH * NS);
    //    for (int i = 0; i < NS; i++) {
    //        for (int t = 0; t < NH; t++) {
    //            VCSEF[NH * i + t] = 0;
    //        }
    //    }
    std::vector<double> PrevEner;
    for (int s = 0; s < NS; s++) {
        PrevEner.push_back(0.5 * ProdCostIn.SolEs[s]);
    }
    int NR_VARIABLES = NH * (NGen + 2 * ND + NR + NHyd + NS * 3 + NGen * 3 + NHyd * 3 + NS * 3 + 1);
    qDebug() << "Nr of variables: " << NR_VARIABLES;

    std::vector<double> CostCoefficients;
    //Cost Vector definition
    for (int i = 0; i < NH * NGen; i++) {
        CostCoefficients.push_back(VCF[i]);
    }
    for (int i = 0; i < NH * ND; i++) {
        CostCoefficients.push_back(VCDF[i]);
    }
    for (int i = 0; i < NH * ND; i++) {
        CostCoefficients.push_back(VCDF[i]);
    }
    for (int i = 0; i < NH * NR; i++) {
        CostCoefficients.push_back(VCRF[i]);
    }
    for (int i = 0; i < NH * NHyd; i++) {
        CostCoefficients.push_back(VCHF[i]);
    }
    for (int i = 0; i < NH * NS; i++) {
        CostCoefficients.push_back(VCSF[i]);
    }
    for (int i = 0; i < NH * NS; i++) {
        CostCoefficients.push_back(VCSF[i]);
    }
    for (int i = 0; i < NH * NS; i++) {
        CostCoefficients.push_back(0.0);
    }
    for (int i = 0; i < NH * NGen; i++) {
        CostCoefficients.push_back(PRCost[i]);
    }
    for (int i = 0; i < NH * NGen; i++) {
        CostCoefficients.push_back(SRCost[i]);
    }
    for (int i = 0; i < NH * NGen; i++) {
        CostCoefficients.push_back(TRCost[i]);
    }
    for (int i = 0; i < NH * NHyd; i++) {
        CostCoefficients.push_back(PRCostHyd[i]);
    }
    for (int i = 0; i < NH * NHyd; i++) {
        CostCoefficients.push_back(SRCostHyd[i]);
    }
    for (int i = 0; i < NH * NHyd; i++) {
        CostCoefficients.push_back(TRCostHyd[i]);
    }
    for (int i = 0; i < NH * NS; i++) {
        CostCoefficients.push_back(0.0); //PRCosts[i]);
    }
    for (int i = 0; i < NH * NS; i++) {
        CostCoefficients.push_back(0.0); //SRCosts[i]);
    }
    for (int i = 0; i < NH * NS; i++) {
        CostCoefficients.push_back(0.0); //TRCosts[i]);
    }
    for (int i = 0; i < NH; i++) {
        CostCoefficients.push_back(lostload1);
    }
    std::cout << "CCsize: " << CostCoefficients.size() << std::endl;


    //Rows definitions
    /*	
    Hourly Balance			NH			(=)
    DR Neutrality			ND			(=)
    Storage Inventory		NH * NS			(=)
    Thermal Capacity		NH * NGen		(<=)
    Storage Charge/Discharge Capacity	2 * NH * NS		(<=)
    Storage Energy Capacity		NH * NS			(<=)
    Demand Response Up/Down Capacity	2 * NH * ND		(<=)
    Renewable Capacity		NH * NR			(<=)
    Hydro capacity			NH * NHyd		(<=)
    Hydro energy			12			(<=)
    Sufficient energy for reserves	NH * NS			(<=)
    Thermal ramping rates           (NH-1)*NGen*2           (<=)
    Storage ramping rates           (NH-1)*NS*4             (<=)
    DR ramping rates                (NH-1)*ND*4             (<=)
    Hydro ramping rates             (NH-1)*NHyd*2           (<=)
    Hourly reserve provision	NH * 3			(>=)
    12+NH*4+NS+ND+NH*NS*5+NH*NGen+2*NH*ND+NH*NR+NH*NHyd+(NH-1)*(NGen+NS+ND+NHyd)
     */

    int PROBLEM_SIZE = NH + ND + NH * NS + NH * NGen + NH * NS * 3 + 2 * NH * ND + NH * NR + NH * NHyd + NHyd + NH * NS + NH * 3; //+ 12;// + NH *NS;//12 + NH * 4 + NS + ND + NH * NS * 5 + NH * NGen + 2 * NH * ND + NH * NR + NH * NHyd;// + (NH - 1)*(NGen * 2 + NS * 4 + ND * 4 + NHyd * 2);
    qDebug() << "Nr of restrictions: " << PROBLEM_SIZE;
    double* Lower_Bounds = new double[PROBLEM_SIZE];
    double* Upper_Bounds = new double[PROBLEM_SIZE];
    int rowv_counter = 0;
    int month;
    int starting_hour;
    const int NonZeroElements = NH * (NGen + NR + NS * 2 + ND * 2 + NHyd) + NH * ND * 2 + 3 * NS + 4 * NS * (NH - 1) + NGen * NH * 4 + NS * NH * 7 + ND * NH * 2 + NR * NH + NHyd * NH * 4 + NH * NHyd + NH * NS * 5 + NH * 3 * (NGen + NHyd + NS); //+ NH*NHyd;//+ NS + ND * (NH * 2) + NS * 3 + NS * (NH - 1) * 4 + NH * NGen * 4 + NH * NS * 7 + NH * ND * 2 + NH * NR + NH * NHyd * 5 + NS * NH * 5  + NH * 3 * (NGen + NS + NHyd); //+ (NH - 1) * (NGen * 4 + NS * 8 + ND * 8 + NHyd * 4);
    qDebug() << "NZE: " << NonZeroElements;
    int* Row_Indexes = new int[NonZeroElements + 1];
    int* Col_Indexes = new int[NonZeroElements + 1];
    //std::array<int,NonZeroElements> Row_Indexes, Col_Indexes;
    double *Mat_Elements = new double[NonZeroElements + 1];
    int glpkCount = 0;
    while (!glpk->__tryLocking(false)) {
        if (glpkCount == 1) {
            glpkCount = 0;
            ThreadSleep(1000);
        }
        glpkCount++;
    }
    
    std::vector<glp_prob *> PROBLEM_VECTOR;
    for (int t = 0; t < NUMBER_OF_DAYS; t++) {
        PROBLEM_VECTOR.push_back(glp_create_prob());
    }

    for (int day = 0; day < NUMBER_OF_DAYS; day++) {
        if (day == 132) {
            int debug = 2;
        }
        if (day == 131) {
            int debug2 = 2;
        }
        glp_set_prob_name(PROBLEM_VECTOR[day], "ProductionCost");
        glp_set_obj_dir(PROBLEM_VECTOR[day], GLP_MIN);
        glp_add_cols(PROBLEM_VECTOR[day], NR_VARIABLES);

        //Structural variables (Columns).
        /*
        Thermal Generation			NH * NGen
        Demand Response Up Shifts		NH * ND
        Demand Response Down Shifts		NH * ND
        Renewable Generation		NH * NR
        Hydro generation			NH * NHyd
        Storage Charging			NH * NS
        Storage Discharging			NH * NS
        Stored energy			NH * NS
        Primary reserve thermal		NH * NGen
        Secondary reserve thermal		NH * NGen
        Tertiary reserve thermal		NH * NGen
        Primary reserve hydro		NH * NHyd
        Secondary reserve hydro		NH * NHyd
        Tertiary reserve hydro		NH * NHyd
        Primary reserve storage		NH * NS
        Secondary reserve storage		NH * NS
        Tertiary reserve storage		NH * NS
        Lost Load                           NH
        NH*(NGen+2*ND+NR+NHyd+NS*3+NGen*3+NHyd*3+NS*3+1)
         */

        for (int i = 0; i < NR_VARIABLES; i++) {
            glp_set_col_bnds(PROBLEM_VECTOR[day], i + 1, GLP_LO, 0.0, 0.0);
            glp_set_obj_coef(PROBLEM_VECTOR[day], i + 1, CostCoefficients[i]);
        }

        qDebug() << "Start calculation for day " << day + 1;
        glp_add_rows(PROBLEM_VECTOR[day], PROBLEM_SIZE);
        //Problem formulation

        month = MonthForDay(day);
        starting_hour = HoursForDay(day);
        rowv_counter = 0;
        for (int i = 0; i < NH; i++) {
            Lower_Bounds[i + rowv_counter] = demandprofile1[starting_hour + i];
            Upper_Bounds[i + rowv_counter] = demandprofile1[starting_hour + i];
        }
        rowv_counter += NH;
        for (int i = 0; i < ND; i++) {
            Lower_Bounds[i + rowv_counter] = 0.0;
            Upper_Bounds[i + rowv_counter] = 0.0;
        }
        rowv_counter += ND;
        for (int i = 0; i < NS; i++) {
            for (int t = 0; t < NH; t++) {
                if (t == 0) {
                    Lower_Bounds[i * NH + t + rowv_counter] = PrevEner[i];
                    Upper_Bounds[i * NH + t + rowv_counter] = PrevEner[i];
                } else {
                    Lower_Bounds[i * NH + t + rowv_counter] = 0.0;
                    Upper_Bounds[i * NH + t + rowv_counter] = 0.0;
                }
            }
            qDebug() << "Previous energy " << i + 1 << ": " << PrevEner[i];
        }
        rowv_counter += NS * NH;
        for (int i = 0; i < NGen; i++) {
            for (int t = 0; t < NH; t++) {
                Lower_Bounds[i * NH + t + rowv_counter] = 0.0;
                Upper_Bounds[i * NH + t + rowv_counter] = ProdCostIn.SolPpeak[i];
            }
        }
        rowv_counter += NGen * NH;
        for (int i = 0; i < NS; i++) {
            for (int t = 0; t < NH; t++) {
                Lower_Bounds[i * NH + t + rowv_counter] = 0.0;
                Upper_Bounds[i * NH + t + rowv_counter] = ProdCostIn.SolPs[i];
            }
        }
        rowv_counter += NS * NH;
        for (int i = 0; i < NS; i++) {
            for (int t = 0; t < NH; t++) {
                Lower_Bounds[i * NH + t + rowv_counter] = 0.0;
                Upper_Bounds[i * NH + t + rowv_counter] = ProdCostIn.SolPs[i];
            }
        }
        rowv_counter += NS * NH;
        for (int i = 0; i < NS; i++) {
            for (int t = 0; t < NH; t++) {
                Lower_Bounds[i * NH + t + rowv_counter] = 0.0;
                Upper_Bounds[i * NH + t + rowv_counter] = ProdCostIn.SolEs[i];
            }
        }
        rowv_counter += NS * NH;
        for (int i = 0; i < ND; i++) {
            for (int t = 0; t < NH; t++) {
                Lower_Bounds[i * NH + t + rowv_counter] = 0.0;
                Upper_Bounds[i * NH + t + rowv_counter] = ProdCostIn.SolPd[i];
            }
        }
        rowv_counter += ND * NH;
        for (int i = 0; i < ND; i++) {
            for (int t = 0; t < NH; t++) {
                Lower_Bounds[i * NH + t + rowv_counter] = 0.0;
                Upper_Bounds[i * NH + t + rowv_counter] = ProdCostIn.SolPd[i];
            }
        }
        rowv_counter += ND * NH;
        for (int i = 0; i < NR; i++) {
            for (int t = 0; t < NH; t++) {
                Lower_Bounds[i * NH + t + rowv_counter] = 0.0;
                Upper_Bounds[i * NH + t + rowv_counter] = ProdCostIn.SolPr[i] * ProdCostIn.common_data.ResourceR[i * NH + starting_hour + t];
            }
        }
        rowv_counter += NR * NH;
        for (int i = 0; i < NHyd; i++) {
            for (int t = 0; t < NH; t++) {
                Lower_Bounds[i * NH + t + rowv_counter] = 0.0;
                Upper_Bounds[i * NH + t + rowv_counter] = ProdCostIn.SolPh[i];
            }
        }
        rowv_counter += NHyd * NH;
        for (int i = 0; i < NHyd; i++) {
            Lower_Bounds[rowv_counter + i] = 0.0;
            Upper_Bounds[rowv_counter + i] = ProdCostIn.common_data.ResourceH[month - 1] / DaysperMonth[month - 1];
        }
        rowv_counter += NHyd;
        for (int i = 0; i < NS; i++) {
            for (int t = 0; t < NH; t++) {
                Lower_Bounds[i * NH + t + rowv_counter] = 0.0;
                Upper_Bounds[i * NH + t + rowv_counter] = 0.0;
            }
        }
        rowv_counter += NS * NH;
        //    /*//Ramping rates
        //    for (int i = 0; i < NGen; i++){
        //        for (int t = 0; t < NH - 1; t++){
        //            Lower_Bounds[i * NH + t + rowv_counter] = 0.0;
        //            Upper_Bounds[i * NH + t + rowv_counter] = ProdCostIn.common_data.Ri[i];
        //        }
        //    }
        //    rowv_counter += NGen * (NH-1);
        //    for (int i = 0; i < NS; i++){
        //        for (int t = 0; t < NH - 1; t++){
        //            Lower_Bounds[i * NH + t + rowv_counter] = 0.0;
        //            Upper_Bounds[i * NH + t + rowv_counter] = ProdCostIn.common_data.RS[i];
        //        }
        //    }
        //    rowv_counter += NS * (NH-1);
        //    for (int i = 0; i < NS; i++){
        //        for (int t = 0; t < NH - 1; t++){
        //            Lower_Bounds[i * NH + t + rowv_counter] = 0.0;
        //            Upper_Bounds[i * NH + t + rowv_counter] = ProdCostIn.common_data.RS[i];
        //        }
        //    }
        //    rowv_counter += NS * (NH-1);
        //    for (int i = 0; i < ND; i++){
        //        for (int t = 0; t < NH - 1; t++){
        //            Lower_Bounds[i * NH + t + rowv_counter] = 0.0;
        //            Upper_Bounds[i * NH + t + rowv_counter] = ProdCostIn.common_data.Rd[i];
        //        }
        //    }
        //    rowv_counter += ND * (NH-1);
        //    for (int i = 0; i < ND; i++){
        //        for (int t = 0; t < NH - 1; t++){
        //            Lower_Bounds[i * NH + t + rowv_counter] = 0.0;
        //            Upper_Bounds[i * NH + t + rowv_counter] = ProdCostIn.common_data.Rd[i];
        //        }
        //    }
        //    rowv_counter += ND * (NH-1);
        //    for (int i = 0; i < NHyd; i++){
        //        for (int t = 0; t < NH - 1; t++){
        //            Lower_Bounds[i * NH + t + rowv_counter] = 0.0;
        //            Upper_Bounds[i * NH + t + rowv_counter] = ProdCostIn.common_data.Rh[i];
        //        }
        //    }
        //    rowv_counter += NHyd * (NH-1);*/
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < NH; j++) {
                Lower_Bounds[rowv_counter + i * NH + j] = ProdCostIn.common_data.ReserveRequirements[i];
                Upper_Bounds[rowv_counter + i * NH + j] = 0.0;
            }
        }
        rowv_counter += NH * 3;
        qDebug() << "Nr of bounds: " << rowv_counter;

        int rowb_counter = 0;
        for (int i = 0; i < NH + ND + NH * NS; i++) {
            glp_set_row_bnds(PROBLEM_VECTOR[day], rowb_counter + 1 + i, GLP_FX, Lower_Bounds[i + rowb_counter], Upper_Bounds[i + rowb_counter]);
        }
        rowb_counter += NH + ND + NH * NS;
        for (int i = 0; i < NHyd + NH * (NGen + NS * 3 + ND * 2 + NR + NHyd + NS); i++) { //+ (NH - 1)*(NGen + 2 * ND + 2 * NS + NHyd); i++) {
            glp_set_row_bnds(PROBLEM_VECTOR[day], rowb_counter + 1 + i, GLP_UP, Lower_Bounds[i + rowb_counter], Upper_Bounds[i + rowb_counter]);
        }
        rowb_counter += NHyd + NH * (NGen + NS * 3 + ND * 2 + NR + NHyd + NS);
        for (int i = 0; i < NH * 3; i++) {
            glp_set_row_bnds(PROBLEM_VECTOR[day], rowb_counter + 1 + i, GLP_LO, Lower_Bounds[i + rowb_counter], Upper_Bounds[i + rowb_counter]);
        }
        rowb_counter += 3 * NH;
        qDebug() << "Nr of bounded rows: " << rowb_counter;

        //Matrix definition. Same order as rows and columns.
        //Rows
        /*					Non Zero Elements
        Hourly Balance			NH * (NGen+NR+NS*2+ND*2+NHyd)	(=)
        DR Neutrality			ND * (NH*2)			(=)
        Storage Inventory			NS * 3 + NS * (NH - 1) * 4	(=)
        Thermal Capacity			NH * NGen * 4			(<=)
        Storage Charge/Discharge Capacity	NH * NS * 6			(<=)
        Storage Energy Capacity		NH * NS 			(<=)
        Demand Response Up/Down Capacity	NH * ND * 2			(<=)
        Renewable Capacity			NH * NR 			(<=)
        Hydro capacity			NH * NHyd * 4			(<=)
        Hydro energy			NH * NHyd			(<=)
        Sufficient energy for reserves	NH * NS * 4			(<=)
        Thermal ramping rates               (NH-1)*NGen*4                   (<=)
        Storage ramping rates               (NH-1)*NS*8                     (<=)
        DR ramping rates                    (NH-1)*ND*8                     (<=)
        Hydro ramping rates                 (NH-1)*NHyd*4                   (<=)
        Hourly reserve provision		NH * 3	* (NGen+NS+NHyd)	(>=)
         * NZE=NH*(NGen+NR+NS*2+ND*2+NHyd)+NS+ND*(NH*2)+NS*3+NS*(NH-1)*4+NH*NGen*4+NH*NS*11+NH*ND*2+NH*NR+NH*NHyd*5+(NH-1)*(NGen*4+NS*8+ND*8+NHyd*4)+NH*3*(NGen+NS+NHyd*ND);
         */


        //std::array<double,NonZeroElements> Mat_Elements;
        int NZEcounter = 0;
        int ROWcounter = 0;
        //    for (int t = 0; t < NonZeroElements + 1; t++){
        //        Mat_Elements[t] = 1;
        //    }

        //Hourly Balance
        for (int i = 0; i < NH; i++) {
            for (int j = 0; j < NGen + NR + NS * 2 + ND * 2 + NHyd; j++) {
                Row_Indexes[j + 1 + NZEcounter] = ROWcounter + 1 + i;
                if (j < NGen) {
                    Col_Indexes[j + 1 + NZEcounter] = 1 + NH * j + i;
                    Mat_Elements[j + 1 + NZEcounter] = 1.0;
                } else if (j < NGen + ND) {
                    Col_Indexes[j + 1 + NZEcounter] = 1 + NH * j + i;
                    Mat_Elements[j + 1 + NZEcounter] = -1.0;
                } else if (j < NGen + ND * 2 + NR + NHyd) {
                    Col_Indexes[j + 1 + NZEcounter] = 1 + NH * j + i;
                    Mat_Elements[j + 1 + NZEcounter] = 1.0;
                } else if (j < NGen + ND * 2 + NR + NHyd + NS) {
                    Col_Indexes[j + 1 + NZEcounter] = 1 + NH * j + i;
                    Mat_Elements[j + 1 + NZEcounter] = -1.0;
                } else {
                    Col_Indexes[j + 1 + NZEcounter] = 1 + NH * j + i;
                    Mat_Elements[j + 1 + NZEcounter] = 1.0;
                }
            }
            NZEcounter += (NGen + NR + NHyd + NS * 2 + ND * 2);
        }
        ROWcounter = ROWcounter + NH;
        qDebug() << "Balance NZE counter: " << NZEcounter;
        qDebug() << "Balance ROW counter: " << ROWcounter;

        //DR Neutrality
        for (int i = 0; i < ND; i++) {
            for (int j = 0; j < NH * 2; j++) {
                Row_Indexes[NZEcounter + 1 + j] = ROWcounter + 1 + i;
                if (j < NH) {
                    Col_Indexes[NZEcounter + 1 + j] = NGen * NH + NH * i + j + 1;
                    Mat_Elements[NZEcounter + 1 + j] = 1.0;
                } else {
                    Mat_Elements[NZEcounter + 1 + j] = -1.0;
                    Col_Indexes[NZEcounter + 1 + j] = NGen * NH + NH * i + j + NH * (ND - 1) + 1;
                }
            }
            NZEcounter = NZEcounter + 2 * NH;
        }
        ROWcounter = ROWcounter + ND;
        qDebug() << "DR Neutrality NZE counter: " << NZEcounter;
        qDebug() << "DR Neutrality ROW counter: " << ROWcounter;

        //Storage Inventory
        for (int i = 0; i < NS; i++) {
            for (int j = 0; j < NH; j++) {
                if (j == 0) {
                    Row_Indexes[NZEcounter + 1] = ROWcounter + 1;
                    Row_Indexes[NZEcounter + 2] = ROWcounter + 1;
                    Row_Indexes[NZEcounter + 3] = ROWcounter + 1;
                    Col_Indexes[NZEcounter + 1] = 1 + NH * (NGen + ND * 2 + NR + NHyd) + NH * i + j;
                    Col_Indexes[NZEcounter + 2] = 1 + NH * (NGen + ND * 2 + NR + NHyd + NS) + NH * i + j;
                    Col_Indexes[NZEcounter + 3] = 1 + NH * (NGen + ND * 2 + NR + NHyd + NS * 2) + NH * i + j;
                    Mat_Elements[NZEcounter + 1] = -ProdCostIn.common_data.ETACs[i];
                    Mat_Elements[NZEcounter + 2] = 1 / ProdCostIn.common_data.ETADs[i];
                    Mat_Elements[NZEcounter + 3] = 1.0;
                    NZEcounter += 3;
                } else {
                    Row_Indexes[NZEcounter + 1] = ROWcounter + 1;
                    Row_Indexes[NZEcounter + 2] = ROWcounter + 1;
                    Row_Indexes[NZEcounter + 3] = ROWcounter + 1;
                    Row_Indexes[NZEcounter + 4] = ROWcounter + 1;
                    Col_Indexes[NZEcounter + 1] = 1 + NH * (NGen + ND * 2 + NR + NHyd) + NH * i + j;
                    Col_Indexes[NZEcounter + 2] = 1 + NH * (NGen + ND * 2 + NR + NHyd + NS) + NH * i + j;
                    Col_Indexes[NZEcounter + 3] = 1 + NH * (NGen + ND * 2 + NR + NHyd + NS * 2) + NH * i + j;
                    Col_Indexes[NZEcounter + 4] = 1 + NH * (NGen + ND * 2 + NR + NHyd + NS * 2) + NH * i + j - 1;
                    Mat_Elements[NZEcounter + 1] = -ProdCostIn.common_data.ETACs[i];
                    Mat_Elements[NZEcounter + 2] = 1 / ProdCostIn.common_data.ETADs[i];
                    Mat_Elements[NZEcounter + 3] = 1.0;
                    Mat_Elements[NZEcounter + 4] = -1.0;
                    NZEcounter += 4;
                }
                ROWcounter = ROWcounter + 1;
            }
        }
        qDebug() << "Inventory NZE counter: " << NZEcounter;
        qDebug() << "Inventory ROW counter: " << ROWcounter;

        //Thermal Capacity
        for (int i = 0; i < NGen; i++) {
            for (int j = 0; j < NH; j++) {
                Row_Indexes[NZEcounter + 1] = ROWcounter + 1;
                Row_Indexes[NZEcounter + 2] = ROWcounter + 1;
                Row_Indexes[NZEcounter + 3] = ROWcounter + 1;
                Row_Indexes[NZEcounter + 4] = ROWcounter + 1;
                Col_Indexes[NZEcounter + 1] = i * NH + j + 1;
                Col_Indexes[NZEcounter + 2] = 1 + NH * (NGen + ND * 2 + NR + NHyd + NS * 3) + i * NH + j;
                Col_Indexes[NZEcounter + 3] = 1 + NH * (NGen * 2 + ND * 2 + NR + NHyd + NS * 3) + i * NH + j;
                Col_Indexes[NZEcounter + 4] = 1 + NH * (NGen * 3 + ND * 2 + NR + NHyd + NS * 3) + i * NH + j;
                Mat_Elements[NZEcounter + 1] = 1.0;
                Mat_Elements[NZEcounter + 2] = 1.0;
                Mat_Elements[NZEcounter + 3] = 1.0;
                Mat_Elements[NZEcounter + 4] = 1.0;
                NZEcounter = NZEcounter + 4;
                ROWcounter = ROWcounter + 1;
            }
        }
        qDebug() << "Thermal Cap NZE counter: " << NZEcounter;
        qDebug() << "Thermal Cap ROW counter: " << ROWcounter;

        //Storage Charge / Discharge Capacity
        for (int i = 0; i < NS; i++) {
            for (int j = 0; j < NH; j++) {
                Row_Indexes[NZEcounter + 1] = ROWcounter + 1;
                Col_Indexes[NZEcounter + 1] = 1 + NH * (NGen + ND * 2 + NR + NHyd) + NH * i + j;
                Mat_Elements[NZEcounter + 1] = 1.0;
                NZEcounter = NZEcounter + 1;
                ROWcounter = ROWcounter + 1;
            }
        }
        for (int i = 0; i < NS; i++) {
            for (int j = 0; j < NH; j++) {
                Row_Indexes[NZEcounter + 1] = ROWcounter + 1;
                Row_Indexes[NZEcounter + 2] = ROWcounter + 1;
                Row_Indexes[NZEcounter + 3] = ROWcounter + 1;
                Row_Indexes[NZEcounter + 4] = ROWcounter + 1;
                Row_Indexes[NZEcounter + 5] = ROWcounter + 1;
                Col_Indexes[NZEcounter + 1] = 1 + NH * (NGen + ND * 2 + NR + NHyd) + NH * i + j;
                Col_Indexes[NZEcounter + 2] = 1 + NH * (NGen + ND * 2 + NR + NHyd + NS) + NH * i + j;
                Col_Indexes[NZEcounter + 3] = 1 + NH * (NGen * 4 + ND * 2 + NR + NHyd * 4 + NS * 3) + NH * i + j;
                Col_Indexes[NZEcounter + 4] = 1 + NH * (NGen * 4 + ND * 2 + NR + NHyd * 4 + NS * 4) + NH * i + j;
                Col_Indexes[NZEcounter + 5] = 1 + NH * (NGen * 4 + ND * 2 + NR + NHyd * 4 + NS * 5) + NH * i + j;
                Mat_Elements[NZEcounter + 1] = -1.0;
                Mat_Elements[NZEcounter + 2] = 1.0;
                Mat_Elements[NZEcounter + 3] = 1.0;
                Mat_Elements[NZEcounter + 4] = 1.0;
                Mat_Elements[NZEcounter + 5] = 1.0;
                NZEcounter = NZEcounter + 5;
                ROWcounter = ROWcounter + 1;
            }
        }
        qDebug() << "Sto Cap NZE counter: " << NZEcounter;
        qDebug() << "Sto Cap ROW counter: " << ROWcounter;

        //Storage Energy Capacity
        for (int i = 0; i < NS; i++) {
            for (int j = 0; j < NH; j++) {
                Row_Indexes[NZEcounter + 1] = ROWcounter + 1;
                Col_Indexes[NZEcounter + 1] = 1 + NH * (NGen + ND * 2 + NR + NHyd + NS * 2) + NH * i + j;
                Mat_Elements[NZEcounter + 1] = 1.0;
                NZEcounter = NZEcounter + 1;
                ROWcounter = ROWcounter + 1;
            }
        }
        qDebug() << "Sto En NZE counter: " << NZEcounter;
        qDebug() << "Sto En ROW counter: " << ROWcounter;

        //Demand Response Up / Down Capacity
        for (int i = 0; i < ND; i++) {
            for (int j = 0; j < NH; j++) {
                Row_Indexes[NZEcounter + 1] = ROWcounter + 1;
                Col_Indexes[NZEcounter + 1] = 1 + NH * NGen + NH * i + j;
                Mat_Elements[NZEcounter + 1] = 1.0;
                NZEcounter = NZEcounter + 1;
                ROWcounter = ROWcounter + 1;
            }
        }
        for (int i = 0; i < ND; i++) {
            for (int j = 0; j < NH; j++) {
                Row_Indexes[NZEcounter + 1] = ROWcounter + 1;
                //Row_Indexes[NZEcounter + 2] = ROWcounter + 1;
                //Row_Indexes[NZEcounter + 3] = ROWcounter + 1;
                //Row_Indexes[NZEcounter + 4] = ROWcounter + 1;
                //Row_Indexes[NZEcounter + 5] = ROWcounter + 1;
                //Col_Indexes[NZEcounter + 1] = 1 + NH * (NGen) + NH * i + j;
                Col_Indexes[NZEcounter + 1] = 1 + NH * (NGen + ND) + NH * i + j;
                //Col_Indexes[NZEcounter + 3] = 1 + NH * (NGen * 4 + ND * 2 + NR + NHyd * 4 + NS * 6) + NH * i + j;
                //Col_Indexes[NZEcounter + 4] = 1 + NH * (NGen * 4 + ND * 3 + NR + NHyd * 4 + NS * 6) + NH * i + j;
                //Col_Indexes[NZEcounter + 5] = 1 + NH * (NGen * 4 + ND * 4 + NR + NHyd * 4 + NS * 6) + NH * i + j;
                //Mat_Elements[NZEcounter + 1] = -1.0;
                Mat_Elements[NZEcounter + 1] = 1.0;
                //Mat_Elements[NZEcounter + 3] = 1.0;
                //Mat_Elements[NZEcounter + 4] = 1.0;
                //Mat_Elements[NZEcounter + 5] = 1.0;
                NZEcounter = NZEcounter + 1;
                ROWcounter = ROWcounter + 1;
            }
        }
        qDebug() << "DemR Cap NZE counter: " << NZEcounter;
        qDebug() << "DemR Cap ROW counter: " << ROWcounter;

        //Renewable Capacity
        for (int i = 0; i < NR; i++) {
            for (int j = 0; j < NH; j++) {
                Row_Indexes[NZEcounter + 1] = ROWcounter + 1;
                Col_Indexes[NZEcounter + 1] = 1 + NH * (NGen + ND * 2) + i * NH + j;
                Mat_Elements[NZEcounter + 1] = 1.0;
                NZEcounter = NZEcounter + 1;
                ROWcounter = ROWcounter + 1;
            }
        }
        qDebug() << "Ren Cap NZE counter: " << NZEcounter;
        qDebug() << "Ren Cap ROW counter: " << ROWcounter;

        //Hydro capacity
        for (int i = 0; i < NHyd; i++) {
            for (int j = 0; j < NH; j++) {
                Row_Indexes[NZEcounter + 1] = ROWcounter + 1;
                Row_Indexes[NZEcounter + 2] = ROWcounter + 1;
                Row_Indexes[NZEcounter + 3] = ROWcounter + 1;
                Row_Indexes[NZEcounter + 4] = ROWcounter + 1;
                Col_Indexes[NZEcounter + 1] = 1 + NH * (NGen + ND * 2 + NR) + i * NH + j;
                Col_Indexes[NZEcounter + 2] = 1 + NH * (NGen * 4 + ND * 2 + NR + NHyd + NS * 3) + i * NH + j;
                Col_Indexes[NZEcounter + 3] = 1 + NH * (NGen * 4 + ND * 2 + NR + NHyd * 2 + NS * 3) + i * NH + j;
                Col_Indexes[NZEcounter + 4] = 1 + NH * (NGen * 4 + ND * 2 + NR + NHyd * 3 + NS * 3) + i * NH + j;
                Mat_Elements[NZEcounter + 1] = 1.0;
                Mat_Elements[NZEcounter + 2] = 1.0;
                Mat_Elements[NZEcounter + 3] = 1.0;
                Mat_Elements[NZEcounter + 4] = 1.0;
                NZEcounter = NZEcounter + 4;
                ROWcounter = ROWcounter + 1;
            }
        }
        qDebug() << "Hyd Cap NZE counter: " << NZEcounter;
        qDebug() << "Hyd Cap ROW counter: " << ROWcounter;

        //Hydro energy
        for (int i = 0; i < NHyd; i++) {
            for (int t = 0; t < NH; t++) {
                Row_Indexes[NZEcounter + 1] = ROWcounter + 1;
                Col_Indexes[NZEcounter + 1] = 1 + NH * (NGen + ND * 2 + NR) + i * NH + t;
                Mat_Elements[NZEcounter + 1] = 1.0;
                NZEcounter++;
            }
            ROWcounter++;
        }
        qDebug() << "Hyd En NZE counter: " << NZEcounter;
        qDebug() << "Hyd En ROW counter: " << ROWcounter;

        //Sufficient energy for reserves
        for (int i = 0; i < NS; i++) {
            for (int j = 0; j < NH; j++) {
                Row_Indexes[NZEcounter + 1] = ROWcounter + 1;
                Row_Indexes[NZEcounter + 2] = ROWcounter + 1;
                Row_Indexes[NZEcounter + 3] = ROWcounter + 1;
                Row_Indexes[NZEcounter + 4] = ROWcounter + 1;
                Row_Indexes[NZEcounter + 5] = ROWcounter + 1;
                Col_Indexes[NZEcounter + 1] = 1 + NH * (NGen + ND * 2 + NR + NHyd + NS) + NH * i + j;
                Col_Indexes[NZEcounter + 2] = 1 + NH * (NGen * 4 + ND * 2 + NR + NHyd * 4 + NS * 3) + NH * i + j;
                Col_Indexes[NZEcounter + 3] = 1 + NH * (NGen * 4 + ND * 2 + NR + NHyd * 4 + NS * 4) + NH * i + j;
                Col_Indexes[NZEcounter + 4] = 1 + NH * (NGen * 4 + ND * 2 + NR + NHyd * 4 + NS * 5) + NH * i + j;
                Col_Indexes[NZEcounter + 5] = 1 + NH * (NGen + ND * 2 + NR + NHyd + NS * 2) + NH * i + j;
                Mat_Elements[NZEcounter + 1] = 1.0;
                Mat_Elements[NZEcounter + 2] = ProdCostIn.common_data.ReserveDuration[0];
                Mat_Elements[NZEcounter + 3] = ProdCostIn.common_data.ReserveDuration[1];
                Mat_Elements[NZEcounter + 4] = ProdCostIn.common_data.ReserveDuration[2];
                Mat_Elements[NZEcounter + 5] = -1.0;
                NZEcounter = NZEcounter + 5;
                ROWcounter = ROWcounter + 1;
            }
        }
        qDebug() << "Sto Energy NZE counter: " << NZEcounter;
        qDebug() << "Sto Energy ROW counter: " << ROWcounter;
        //
        ////    /*//Thermal ramping rates
        ////    for (int i = 0; i < NGen; i++) {
        ////        for (int t = 1; t < NH; t++) {
        ////            Row_Indexes[NZEcounter + 1] = ROWcounter + 1;
        ////            Row_Indexes[NZEcounter + 2] = ROWcounter + 1;
        ////            Col_Indexes[NZEcounter + 1] = 1 + NH * i + t;
        ////            Col_Indexes[NZEcounter + 2] = 1 + NH * i + t - 1;
        ////            Mat_Elements[NZEcounter + 1] = 1.0;
        ////            Mat_Elements[NZEcounter + 1] = -1.0;
        ////        }
        ////    }*/
        //
        //    /*//Storage ramping rates       Need more thinking about formulation
        //    for (int i = 0; i < NS; i++){
        //        for (int t = 1; t < NH; t++){
        //            Row_Indexes[NZEcounter + 1] = ROWcounter + 1;
        //            Row_Indexes[NZEcounter + 2] = ROWcounter + 1;
        //            Col_Indexes[NZEcounter + 1] = 1 + NH * i + t;
        //            Col_Indexes[NZEcounter + 2] = 1 + NH * i + t - 1;
        //            Mat_Elements[NZEcounter + 1] = 1.0;
        //            Mat_Elements[NZEcounter + 1] = -1.0;
        //        }
        //    }*/
        //
        //Hourly reserve provision
        for (int i = 0; i < 3; i++) {
            for (int t = 0; t < NH; t++) {
                for (int j = 0; j < NGen; j++) {
                    Row_Indexes[NZEcounter + 1] = ROWcounter + 1;
                    Col_Indexes[NZEcounter + 1] = 1 + NH * (NGen + ND * 2 + NR + NHyd + NS * 3 + (NGen) * i) + j * NH + t;
                    Mat_Elements[NZEcounter + 1] = 1.0;
                    NZEcounter = NZEcounter + 1;
                }
                for (int j = 0; j < NHyd; j++) {
                    Row_Indexes[NZEcounter + 1] = ROWcounter + 1;
                    Col_Indexes[NZEcounter + 1] = 1 + NH * (NGen * 4 + ND * 2 + NR + NHyd + NS * 3) + NH * NHyd * i + j * NH + t;
                    Mat_Elements[NZEcounter + 1] = 1.0;
                    NZEcounter = NZEcounter + 1;
                }
                for (int j = 0; j < NS; j++) {
                    Row_Indexes[NZEcounter + 1] = ROWcounter + 1;
                    Col_Indexes[NZEcounter + 1] = 1 + NH * (NGen * 4 + ND * 2 + NR + NHyd * 4 + NS * 3 + NS * i) + j * NH + t;
                    Mat_Elements[NZEcounter + 1] = 1.0;
                    NZEcounter = NZEcounter + 1;
                }
                /*for (int j = 0; j < ND; j++) {
                    Row_Indexes[NZEcounter + 1] = ROWcounter + 1;
                    Col_Indexes[NZEcounter + 1] = 1 + NH * (NGen * 4 + ND * 2 + NR + NHyd * 4 + NS * 6) + NH * ND * i + j * NH + t;
                    Mat_Elements[NZEcounter + 1] = 1.0;
                    NZEcounter = NZEcounter + 1;
                }*/
                ROWcounter = ROWcounter + 1;
            }
        }
        qDebug() << "Reserve Prov NZE counter: " << NZEcounter;
        qDebug() << "Reserve Prov ROW counter: " << ROWcounter;

        //   const int * Row_Ind, *Col_Ind;
        //    const double *Mat_Ele;
        //    Row_Ind = &Row_Indexes[0];
        //    Col_Ind = &Col_Indexes[0];
        //    Mat_Ele = &Mat_Elements[0];

        glp_load_matrix(PROBLEM_VECTOR[day], NZEcounter, Row_Indexes, Col_Indexes, Mat_Elements);

        glp_smcp param;
        glp_init_smcp(&param);
        param.msg_lev = GLP_MSG_ALL;
        param.meth = GLP_DUAL;
        param.pricing = GLP_PT_PSE;
        param.r_test = GLP_RT_HAR;
        param.tol_bnd = 1e-7;
        param.tol_dj = 1e-7;
        param.tol_piv = 1e-10;
        param.out_frq = 500;
        param.out_dly = 0;
        param.presolve = GLP_ON;
        param.excl = GLP_ON;
        param.shift = GLP_ON;
        param.aorn = GLP_USE_AT;

        int status = glp_simplex(PROBLEM_VECTOR[day], &param);
        if (status != 0) {
            not_normal.push_back(day);
            not_normal_status.push_back(status);
        }
        qDebug() << "Solution status: " << status;

        std::vector<double> variables;
        //Obtaining optimal values of variables
        for (int i = 0; i < NR_VARIABLES; ++i) {
            variables.push_back(glp_get_col_prim(PROBLEM_VECTOR[day], i + 1));
        }
        int extract_counter = 0;
        for (int i = 0; i < NGen * NH; i++) //Peaking plants generation
        {
            results.G_peak.push_back(variables[i + extract_counter]);
        }
        extract_counter = extract_counter + NGen * NH;
        for (int i = 0; i < ND * NH; i++) //Demand response up-shifts
        {
            results.DR_up.push_back(variables[i + extract_counter]);
        }
        extract_counter = extract_counter + ND * NH;
        for (int i = 0; i < ND * NH; i++) //Demand response down-shifts
        {
            results.DR_dn.push_back(variables[i + extract_counter]);
        }
        extract_counter = extract_counter + ND * NH;
        for (int i = 0; i < NR * NH; i++) //Renewables generation
        {
            results.G_ren.push_back(variables[i + extract_counter]);
        }

        extract_counter = extract_counter + NR * NH;
        for (int i = 0; i < NHyd * NH; i++) //Renewables generation
        {
            results.G_H.push_back(variables[i + extract_counter]);
        }
        extract_counter = extract_counter + NHyd * NH;
        for (int i = 0; i < NS * NH; i++) //Storage charging
        {
            results.G_CS.push_back(variables[i + extract_counter]);
        }
        extract_counter = extract_counter + NS * NH;
        for (int i = 0; i < NS * NH; i++) //Storage discharging
        {
            results.G_DS.push_back(variables[i + extract_counter]);
        }
        extract_counter = extract_counter + NS * NH;
        for (int i = 0; i < NS; i++) //Stored energy
        {
            for (int t = 0; t < NH; t++) {
                results.E_ST.push_back(variables[i * NH + t + extract_counter]);
                if (t == NH - 1) {
                    PrevEner[i] = variables[i * NH + t + extract_counter];
                }
            }
        }
        extract_counter = extract_counter + NS * NH;
        //results.RP_dem.reserve(ND*NH);
        for (int i = 0; i < NGen * NH; i++) //Peaking plants primary reserve
        {
            results.RP_peak.push_back(variables[i + extract_counter]);
        }
        extract_counter = extract_counter + NGen * NH;
        for (int i = 0; i < NGen * NH; i++) //Peaking plants secondary reserve
        {
            results.RS_peak.push_back(variables[i + extract_counter]);
        }
        extract_counter = extract_counter + NGen * NH;
        for (int i = 0; i < NGen * NH; i++) //Peaking plants tertiary reserve
        {
            results.RT_peak.push_back(variables[i + extract_counter]);
        }
        extract_counter = extract_counter + NGen * NH;
        for (int i = 0; i < NHyd * NH; i++) //Hydro plants primary reserve
        {
            results.RP_hyd.push_back(variables[i + extract_counter]);
        }
        extract_counter = extract_counter + NHyd * NH;
        for (int i = 0; i < NHyd * NH; i++) //Hydro plants secondary reserve
        {
            results.RS_hyd.push_back(variables[i + extract_counter]);
        }
        extract_counter = extract_counter + NHyd * NH;
        for (int i = 0; i < NHyd * NH; i++) //Hydro plants tertiary reserve
        {
            results.RT_hyd.push_back(variables[i + extract_counter]);
        }
        extract_counter = extract_counter + NHyd * NH;
        for (int i = 0; i < NS * NH; i++) //Storage plants primary reserve
        {
            results.RP_sto.push_back(variables[i + extract_counter]);
        }
        extract_counter = extract_counter + NS * NH;
        for (int i = 0; i < NS * NH; i++) //Storage plants secondary reserve
        {
            results.RS_sto.push_back(variables[i + extract_counter]);
        }
        extract_counter = extract_counter + NS * NH;
        for (int i = 0; i < NS * NH; i++) //Storage plants tertiary reserve
        {
            results.RT_sto.push_back(variables[i + extract_counter]);
        }
        extract_counter = extract_counter + NS * NH;
        for (int t = 0; t < NH; t++) {
            results.LL.push_back(variables[t + extract_counter]);
        }
        extract_counter += NH;
        //        for (int s = 0; s < NS; s++){
        //            PrevEner[s] = results.E_ST[starting_hour + (s+1)*NH-1];
        //        }
        /*for (int i = 0; i < ND * NH; i++) //DemResp plants primary reserve
        {
                results.RP_dem[i] = variables[i + extract_counter];
        }
        extract_counter = extract_counter + ND * NH;
        for (int i = 0; i < ND * NH; i++) //DemResp plants secondary reserve
        {
                results.RS_dem[i] = variables[i + extract_counter];
        }
        extract_counter = extract_counter + ND * NH;
        for (int i = 0; i < ND * NH; i++) //DemResp plants tertiary reserve
        {
                results.RT_dem[i] = variables[i + extract_counter];
        }
        extract_counter = extract_counter + ND * NH;*/

        //Obtaining dual variables
        for (int i = 0; i < NH; i++) {
            results.energyPrice[starting_hour + i] = glp_get_row_dual(PROBLEM_VECTOR[day], i + 2);
        }
        for (int i = 0; i < NH; i++) {
            results.RP_price[starting_hour + i] = glp_get_row_dual(PROBLEM_VECTOR[day], 1 + PROBLEM_SIZE - NH * 3 + i);
        }
        for (int i = 0; i < NH; i++) {
            results.RS_price[starting_hour + i] = glp_get_row_dual(PROBLEM_VECTOR[day], 1 + PROBLEM_SIZE - NH * 2 + i);
        }
        for (int i = 0; i < NH; i++) {
            //qDebug() << i;
            results.RT_price[starting_hour + i] = glp_get_row_dual(PROBLEM_VECTOR[day], 1 + PROBLEM_SIZE - NH * 1 + i);
        }

        //        for (int i = 0; i < NH; ++i) {
        //            results.energyPrice[i] = glp_get_row_dual(PROBLEM_VECTOR[day], i + 2);
        //            results.RP_price[i] = glp_get_row_dual(PROBLEM_VECTOR[day], 1 + PROBLEM_SIZE - NH * 3 + i);
        //            results.RS_price[i] = glp_get_row_dual(PROBLEM_VECTOR[day], 1 + PROBLEM_SIZE - NH * 2 + i);
        //            results.RT_price[i] = glp_get_row_dual(PROBLEM_VECTOR[day], 1 + PROBLEM_SIZE - NH * 1 + i);
        //        }

        glp_delete_prob(PROBLEM_VECTOR[day]);

    }
    glpk->unLocking();
    delete Row_Indexes;
    delete Col_Indexes;
    delete Mat_Elements;
    qDebug() << "GRen size: " << results.G_ren.size();

    std::string GenFileName = "PC_generation_noess_";
    GenFileName = GenFileName + std::to_string(year) + "_" + std::to_string(scenario_and_cases_row_id) + ".csv";
    QFile file5(QString::fromStdString(GenFileName));
    if (file5.exists()) {
        file5.remove();
    }
    if (!file5.open(QIODevice::ReadWrite | QIODevice::Text)) {
        std::cout << "Error opening output file. Please try again.";
    }
    QTextStream out5(&file5);
    QString value = QString::fromStdString("Hour,");
    for (int i = 0; i < NGen; i++) {
        value += QString::fromStdString(thermtype[i]).append(",");
    }
    for (int i = 0; i < ND; i++) {
        value += QString::fromStdString("Demand_Response_Up_" + std::to_string(i + 1)).append(",");
    }
    for (int i = 0; i < ND; i++) {
        value += QString::fromStdString("Demand_Response_Down_" + std::to_string(i + 1)).append(",");
    }
    value += QString::fromStdString("Wind").append(",");
    value += QString::fromStdString("Solar").append(",");
    for (int i = 0; i < NHyd; i++) {
        value += QString::fromStdString("Hydro_" + std::to_string(i + 1)).append(",");
    }
    for (int i = 0; i < NS; i++) {
        value += QString::fromStdString(stotype[i] + "_Ch").append(",");
    }
    for (int i = 0; i < NS; i++) {
        value += QString::fromStdString(stotype[i] + "_Dc").append(",");
    }
    /*for (int i = 0; i < NS; i++) {
        value += QString::fromStdString("EST_" + std::to_string(i + 1)).append(",");
    }*/
    value += QString("Lost Load,");
    value += QString("Demand");
    value += QString("\n");
    out5 << value.toUtf8();
    //NH=8760;
    for (int day = 0; day < NUMBER_OF_DAYS; day++) {
        for (int t = 0; t < NH; t++) {
            out5 << QString::number(day * NH + t + 1).toUtf8() << QString(",").toUtf8();
            for (int i = 0; i < NGen; i++) {
                out5 << QString::number(results.G_peak[day * NH * NGen + i * NH + t]).toUtf8() << QString(",").toUtf8();
            }
            for (int i = 0; i < ND; i++) {
                out5 << QString::number(results.DR_up[day * NH * ND + i * NH + t]).toUtf8() << QString(",").toUtf8();
            }
            for (int i = 0; i < ND; i++) {
                out5 << QString::number(results.DR_dn[day * NH * ND + i * NH + t]).toUtf8() << QString(",").toUtf8();
            }
            for (int i = 0; i < NR; i++) {
                out5 << QString::number(results.G_ren[day * NH * NR + i * NH + t]).toUtf8() << QString(",").toUtf8();
            }
            for (int i = 0; i < NHyd; i++) {
                out5 << QString::number(results.G_H[day * NH * NHyd + i * NH + t]).toUtf8() << QString(",").toUtf8();
            }
            for (int i = 0; i < NS; i++) {
                out5 << QString::number(results.G_CS[day * NH * NS + i * NH + t]).toUtf8() << QString(",").toUtf8();
            }
            for (int i = 0; i < NS; i++) {
                out5 << QString::number(results.G_DS[day * NH * NS + i * NH + t]).toUtf8() << QString(",").toUtf8();
            }
            /*for (int i = 0; i < NS; i++) {
                out5 << QString::number(results.E_ST[day*NH*NS+i * NH + t]).toUtf8() << QString(",").toUtf8();
            }*/
            out5 << QString::number(results.LL[day * NH + t]).toUtf8() << QString(",").toUtf8();
            out5 << QString::number(demandprofile1[day * NH + t]).toUtf8() << QString(",").toUtf8();
            out5 << QString::fromStdString("\n").toUtf8();
        }
    }

    std::string PRFileName = "PC_primres_noess_";
    PRFileName = PRFileName + std::to_string(year) + "_" + std::to_string(scenario_and_cases_row_id) + ".csv";
    QFile file6(QString::fromStdString(PRFileName));
    if (file6.exists()) {
        file6.remove();
    }
    if (!file6.open(QIODevice::ReadWrite | QIODevice::Text)) {
        std::cout << "Error opening output file. Please try again.";
    }
    QTextStream out6(&file6);

    QString row1 = QString::fromStdString("Hour,");
    for (int i = 0; i < NGen; i++) {
        row1 += QString::fromStdString(thermtype[i]).append(",");
    }
    for (int i = 0; i < NHyd; i++) {
        row1 += QString::fromStdString("Hydro_" + std::to_string(i + 1)).append(",");
    }
    for (int i = 0; i < NS; i++) {
        row1 += QString::fromStdString(stotype[i]).append(",");
    }
    row1 += QString::fromStdString("\n");
    out6 << row1.toUtf8();
    for (int day = 0; day < NUMBER_OF_DAYS; day++) {
        for (int t = 0; t < NH; t++) {
            out6 << QString::number(day * NH + t + 1).toUtf8() << QString(",").toUtf8();
            for (int i = 0; i < NGen; i++) {
                out6 << QString::number(results.RP_peak[day * NH * NGen + i * NH + t]).toUtf8() << QString(",").toUtf8();
            }
            //           for (int i = 0; i < ND; i++){
            //               out6 << results.RP_dem[i*NH+t] << ",";
            //           }
            for (int i = 0; i < NHyd; i++) {
                out6 << QString::number(results.RP_hyd[day * NH * NHyd + i * NH + t]).toUtf8() << QString(",").toUtf8();
            }
            for (int i = 0; i < NS; i++) {
                out6 << QString::number(results.RP_sto[day * NH * NS + i * NH + t]).toUtf8() << QString(",").toUtf8();
            }
            out6 << QString::fromStdString("\n").toUtf8();
        }
    }

    std::string SRFileName = "PC_secres_noess_";
    SRFileName = SRFileName + std::to_string(year) + "_" + std::to_string(scenario_and_cases_row_id) + ".csv";
    QFile file7(QString::fromStdString(SRFileName));
    if (file7.exists()) {
        file7.remove();
    }
    if (!file7.open(QIODevice::ReadWrite | QIODevice::Text)) {
        qDebug() << "Error opening output file. Please try again.";
    }
    QTextStream out7(&file7);

    QString row = "Hour,";
    for (int i = 0; i < NGen; i++) {
        row += QString::fromStdString(thermtype[i] + ",");
    }
    for (int i = 0; i < NHyd; i++) {
        row += QString::fromStdString("Hydro_" + std::to_string(i + 1) + ",");
    }
    for (int i = 0; i < NS; i++) {
        row += QString::fromStdString(stotype[i] + ",");
    }
    row += QString::fromStdString("\n");
    out7 << row.toUtf8();
    for (int day = 0; day < NUMBER_OF_DAYS; day++) {
        for (int t = 0; t < NH; t++) {
            out7 << QString::number(day * NH + t + 1).toUtf8() << QString(",").toUtf8();
            for (int i = 0; i < NGen; i++) {
                out7 << QString::number(results.RS_peak[day * NH * NGen + i * NH + t]).toUtf8() << QString(",").toUtf8();
            }
            //           for (int i = 0; i < ND; i++){
            //               out7 << results.RS_dem[i*NH+t] << ",";
            //           }
            for (int i = 0; i < NHyd; i++) {
                out7 << QString::number(results.RS_hyd[day * NH * NHyd + i * NH + t]).toUtf8() << QString(",").toUtf8();
            }
            for (int i = 0; i < NS; i++) {
                out7 << QString::number(results.RS_sto[day * NH * NS + i * NH + t]).toUtf8() << QString(",").toUtf8();
            }
            out7 << QString::fromStdString("\n").toUtf8();
        }
    }
    std::string TRFileName = "PC_tertres_noess_";
    TRFileName = TRFileName + std::to_string(year) + "_" + std::to_string(scenario_and_cases_row_id) + ".csv";
    QFile file8(QString::fromStdString(TRFileName));
    if (file8.exists()) {
        file8.remove();
    }
    if (!file8.open(QIODevice::ReadWrite | QIODevice::Text)) {
        std::cout << "Error opening output file. Please try again.";
    }
    //Changed QDataStream to QTextStream?
    QTextStream out8(&file8);
    QString row2 = QString::fromStdString("Hour,");
    for (int i = 0; i < NGen; i++) {
        row2 += QString::fromStdString(thermtype[i] + ",");
    }
    //        for (int i = 0; i < ND; i++){
    //            out8 << "DRTR_" + std::to_string(i+1) + ",";
    //        }
    for (int i = 0; i < NHyd; i++) {
        row2 += QString::fromStdString("Hydro_" + std::to_string(i + 1) + ",");
    }
    for (int i = 0; i < NS; i++) {
        row2 += QString::fromStdString(stotype[i] + ",");
    }
    row2 += QString::fromStdString("\n");
    out8 << row2.toUtf8();
    for (int day = 0; day < NUMBER_OF_DAYS; day++) {
        for (int t = 0; t < NH; t++) {
            out8 << QString::number(day * NH + t + 1).toUtf8() << QString(",").toUtf8();
            for (int i = 0; i < NGen; i++) {
                out8 << QString::number(results.RT_peak[day * NH * NGen + i * NH + t]).toUtf8() << QString(",").toUtf8();
            }
            //           for (int i = 0; i < ND; i++){
            //               out8 << results.RP_dem[i*NH+t] << ",";
            //           }
            for (int i = 0; i < NHyd; i++) {
                out8 << QString::number(results.RT_hyd[day * NH * NHyd + i * NH + t]).toUtf8() << QString(",").toUtf8();
            }
            for (int i = 0; i < NS; i++) {
                out8 << QString::number(results.RT_sto[day * NH * NS + i * NH + t]).toUtf8() << QString(",").toUtf8();
            }
            out8 << QString::fromStdString("\n").toUtf8();
        }
    }
    std::string EPFileName = "PC_enerprice_noess_";
    EPFileName = EPFileName + std::to_string(year) + "_" + std::to_string(scenario_and_cases_row_id) + ".csv";
    QFile file9(QString::fromStdString(EPFileName));
    if (file9.exists()) {
        file9.remove();
    }
    if (!file9.open(QIODevice::ReadWrite | QIODevice::Text)) {
        std::cout << "Error opening output file. Please try again.";
    }
    QTextStream out9(&file9);
    out9 << QString::fromStdString("Hour,EnerPrice\n").toUtf8();
    for (int day = 0; day < NUMBER_OF_DAYS; day++) {
        for (int t = 0; t < NH; t++) {
            out9 << QString::number(day * NH + t + 1).toUtf8() << QString(",").toUtf8();
            out9 << QString::number(results.energyPrice[day * NH + t]).toUtf8() << QString::fromStdString("\n").toUtf8();
        }
    }

    std::string RPFileName = "PC_resprice_noess_";
    RPFileName = RPFileName + std::to_string(year) + "_" + std::to_string(scenario_and_cases_row_id) + ".csv";
    QFile file10(QString::fromStdString(RPFileName));
    if (file10.exists()) {
        file10.remove();
    }
    if (!file10.open(QIODevice::ReadWrite | QIODevice::Text)) {
        std::cout << "Error opening output file. Please try again.";
    }
    QTextStream out10(&file10);
    out10 << QString::fromStdString("Hour,PR_Price,SR_Price,TR_Price\n").toUtf8();
    for (int day = 0; day < NUMBER_OF_DAYS; day++) {
        for (int t = 0; t < NH; t++) {
            out10 << QString::number(day * NH + t + 1).toUtf8() << QString(",").toUtf8();
            out10 << QString::number(results.RP_price[day * NH + t]).toUtf8() << "," << QString::number(results.RS_price[day * NH + t]).toUtf8() << "," << QString::number(results.RT_price[day * NH + t]).toUtf8() << QString::fromStdString("\n").toUtf8(); //"," << results.RT_price[t] << QString::fromStdString("\n");
        }
    }

    /////////// Do metric//////////////////
    //PC enprice: day & energyPrice  



    Metric_Table metrics;
    metrics.fom_cost = new double[NGen + NR + NHyd];
    metrics.vom_cost = new double[NGen + NR + NHyd];
    metrics.fuel_cost = new double[NGen + NR + NHyd];
    metrics.fuel_burn = new double[NGen];
    metrics.emissions = new double[NGen];
    metrics.generation_energy_revenue = new double[NGen + NR + NHyd];
    metrics.generation_primary_reserve_revenue = new double[NGen + NR + NHyd];
    metrics.generation_secondary_reserve_revenue = new double[NGen + NR + NHyd];
    metrics.generation_tertiary_reserve_revenue = new double[NGen + NR + NHyd];
    metrics.generation_primary_reserve_cost = new double[NGen + NR + NHyd];
    metrics.generation_secondary_reserve_cost = new double[NGen + NR + NHyd];
    metrics.generation_tertiary_reserve_cost = new double[NGen + NR + NHyd];
    metrics.storage_energy_revenue = new double[NS];
    metrics.storage_primary_reserve_revenue = new double[NS];
    metrics.storage_secondary_reserve_revenue = new double[NS];
    metrics.storage_tertiary_reserve_revenue = new double[NS];
    metrics.storage_primary_reserve_cost = new double[NS];
    metrics.storage_secondary_reserve_cost = new double[NS];
    metrics.storage_tertiary_reserve_cost = new double[NS];
    metrics.foms_cost = new double[NS];
    metrics.voms_cost = new double[NS];
    for (int i = 0; i < NGen + NR + NHyd; i++) {
        metrics.fom_cost[i] = 0.0;
        metrics.vom_cost[i] = 0.0;
        metrics.fuel_cost[i] = 0.0;
        metrics.generation_energy_revenue[i] = 0.0;
        metrics.generation_primary_reserve_revenue[i] = 0.0;
        metrics.generation_secondary_reserve_revenue[i] = 0.0;
        metrics.generation_tertiary_reserve_revenue[i] = 0.0;
        metrics.generation_primary_reserve_cost[i] = 0.0;
        metrics.generation_secondary_reserve_cost[i] = 0.0;
        metrics.generation_tertiary_reserve_cost[i] = 0.0;
    }
    for (int i = 0; i < NS; i++) {
        metrics.storage_energy_revenue[i] = 0.0;
        metrics.storage_primary_reserve_revenue[i] = 0.0;
        metrics.storage_secondary_reserve_revenue[i] = 0.0;
        metrics.storage_tertiary_reserve_revenue[i] = 0.0;
        metrics.voms_cost[i] = 0.0;
        metrics.foms_cost[i] = 0.0;
    }
    for (int i = 0; i < NGen; i++) {
        metrics.fuel_burn[i] = 0.0;
        metrics.emissions[i] = 0.0;
    }

    //    std::fill((double*)metrics.fom_cost,(double*)metrics.fom_cost+sizeof(metrics.fom_cost)/sizeof(double),0.0);
    //    std::fill((double*)metrics.vom_cost,(double*)metrics.vom_cost+sizeof(metrics.vom_cost)/sizeof(double),0.0);
    //    std::fill((double*)metrics.fuel_cost,(double*)metrics.fuel_cost+sizeof(metrics.fuel_cost)/sizeof(double),0.0);
    //    std::fill((double*)metrics.generation_energy_revenue,(double*)metrics.generation_energy_revenue+sizeof(metrics.generation_energy_revenue)/sizeof(double),0.0);
    //    std::fill((double*)metrics.generation_primary_reserve_revenue,(double*)metrics.generation_primary_reserve_revenue+sizeof(metrics.generation_primary_reserve_revenue)/sizeof(double),0.0);
    //    std::fill((double*)metrics.generation_secondary_reserve_revenue,(double*)metrics.generation_secondary_reserve_revenue+sizeof(metrics.generation_secondary_reserve_revenue)/sizeof(double),0.0);
    //    std::fill((double*)metrics.generation_tertiary_reserve_revenue,(double*)metrics.generation_tertiary_reserve_revenue+sizeof(metrics.generation_tertiary_reserve_revenue)/sizeof(double),0.0);
    //   // std::fill((double*)metrics.storage_energy_revenue,(double*)metrics.storage_energy_revenue+sizeof(metrics.storage_energy_revenue)/sizeof(double),0.0);



    // double fuel_cost=0;
    for (int day = 0; day < NUMBER_OF_DAYS; day++) {

        for (int t = 0; t < NH; t++) {
            for (int i = 0; i < NGen; i++) {
                // ThermGen_1,2,3..
                //fuel_cost+=results.G_peak[day * NH * NGen + i * NH + t]; 
                //1/1000 to convert from MWh to GWh.
                //Heat Rates to convert from GWh to GJ of burnt fuel.
                metrics.fuel_cost[i] += results.G_peak[day * NH * NGen + i * NH + t] * ProdCostIn.common_data.Heat_Rates[i] * ProdCostIn.common_data.FuelCost[i];
                metrics.fuel_burn[i] += results.G_peak[day * NH * NGen + i * NH + t] * ProdCostIn.common_data.Heat_Rates[i];
                metrics.emissions[i] += results.G_peak[day * NH * NGen + i * NH + t] * ProdCostIn.common_data.Heat_Rates[i] * ProdCostIn.common_data.Emissions[i];
            }
            for (int i = 0; i < NR; i++) {
                // RenGen 1,2,3
                metrics.fuel_cost[i + NGen] += 0.0;
                //fuel_cost+=results.G_ren[day * NH * NR + i * NH + t];
            }
            for (int i = 0; i < NHyd; i++) {
                //hyGen 1
                metrics.fuel_cost[i + NGen + NR] += 0.0;

            }
        }
    }


    // double vom_cost=0;
    for (int day = 0; day < NUMBER_OF_DAYS; day++) {

        for (int t = 0; t < NH; t++) {
            for (int i = 0; i < NGen; i++) {
                // ThermGen_1,2,3..
                metrics.vom_cost[i] += results.G_peak[day * NH * NGen + i * NH + t] * ProdCostIn.common_data.VOM[i];
                //vom_cost+=results.G_peak[day * NH * NGen + i * NH + t];  
            }
            for (int i = 0; i < NR; i++) {
                // RenGen 1,2,3
                // vom_cost+=results.G_ren[day * NH * NR + i * NH + t];
                metrics.vom_cost[i + NGen] += results.G_ren[day * NH * NR + i * NH + t] * ProdCostIn.common_data.VOMr[i];
            }
            for (int i = 0; i < NHyd; i++) {
                //hyGen 1
                metrics.vom_cost[i + NGen + NR] += results.G_H[day * NH * NHyd + i * NH + t] * ProdCostIn.common_data.VOMh[i];
            }
        }
    }
    //double fom_cost=0;
    for (int i = 0; i < NGen; i++) {
        // ThermGen_1,2,3..
        metrics.fom_cost[i] += ProdCostIn.SolPpeak[i] * ProdCostIn.common_data.FOM[i];
        //fom_cost+=results.G_peak[day * NH * NGen + i * NH + t];
    }
    for (int i = 0; i < NR; i++) {
        // RenGen 1,2,3
        metrics.fom_cost[i + NGen] += ProdCostIn.SolPr[i] * ProdCostIn.common_data.FOMr[i];
        //fom_cost+=results.G_ren[day * NH * NR + i * NH + t];
    }
    for (int i = 0; i < NHyd; i++) {
        //hyGen 1
        metrics.fom_cost[i + NGen + NR] += ProdCostIn.SolPh[i] * ProdCostIn.common_data.FOMh[i];
        //fom_cost+=results.G_H[day * NH * NHyd + i * NH + t];
    }

    //double generation_energy_revenue=0;
    for (int day = 0; day < NUMBER_OF_DAYS; day++) {

        for (int t = 0; t < NH; t++) {
            for (int i = 0; i < NGen; i++) {
                // ThermGen_1,2,3..
                // metrics.generation_energy_revenue[i]+=results.energyPrice[day * NH + t]*results.G_peak[day * NH * NGen + i * NH + t];  
                metrics.generation_energy_revenue[i] += results.energyPrice[day * NH + t] * results.G_peak[day * NH * NGen + i * NH + t];
            }
            for (int i = 0; i < NR; i++) {
                // RenGen 1,2,3
                metrics.generation_energy_revenue[i + NGen] += results.energyPrice[day * NH + t] * results.G_ren[day * NH * NR + i * NH + t];
            }
            for (int i = 0; i < NHyd; i++) {
                //hyGen 1
                metrics.generation_energy_revenue[i + NGen + NR] += results.energyPrice[day * NH + t] * results.G_H[day * NH * NHyd + i * NH + t];
            }
        }
    }

    //double generation_primary_reserve_revenue=0;
    for (int day = 0; day < NUMBER_OF_DAYS; day++) {
        for (int t = 0; t < NH; t++) {

            for (int i = 0; i < NGen; i++) {
                metrics.generation_primary_reserve_revenue[i] += results.RP_price[day * NH + t] * results.RP_peak[day * NH * NGen + i * NH + t];
                metrics.generation_primary_reserve_cost[i] += ProdCostIn.common_data.PResC[i] * results.RP_peak[day * NH * NGen + i * NH + t];
            }

            for (int i = 0; i < NHyd; i++) {
                metrics.generation_primary_reserve_revenue[i + NGen + NR] += results.RP_price[day * NH + t] * results.RP_hyd[day * NH * NHyd + i * NH + t];
                metrics.generation_primary_reserve_cost[i + NGen + NR] += ProdCostIn.common_data.PResCh[i] * results.RP_hyd[day * NH * NHyd + i * NH + t];
            }

        }
    }

    // double generation_secondary_reserve_revenue=0; 
    for (int day = 0; day < NUMBER_OF_DAYS; day++) {
        for (int t = 0; t < NH; t++) {

            for (int i = 0; i < NGen; i++) {
                metrics.generation_secondary_reserve_revenue[i] += results.RS_price[day * NH + t] * results.RS_peak[day * NH * NGen + i * NH + t];
                metrics.generation_secondary_reserve_cost[i] += ProdCostIn.common_data.SResC[i] * results.RS_peak[day * NH * NGen + i * NH + t];
            }

            for (int i = 0; i < NHyd; i++) {
                metrics.generation_secondary_reserve_revenue[i + NGen + NR] += results.RS_price[day * NH + t] * results.RS_hyd[day * NH * NHyd + i * NH + t];
                metrics.generation_secondary_reserve_cost[i + NGen + NR] += ProdCostIn.common_data.SResCh[i] * results.RS_hyd[day * NH * NHyd + i * NH + t];
            }

        }
    }

    // double generation_tertiary_reserve_revenue=0; 
    for (int day = 0; day < NUMBER_OF_DAYS; day++) {
        for (int t = 0; t < NH; t++) {

            for (int i = 0; i < NGen; i++) {
                metrics.generation_tertiary_reserve_revenue[i] += results.RT_price[day * NH + t] * results.RT_peak[day * NH * NGen + i * NH + t];
                metrics.generation_tertiary_reserve_cost[i] += ProdCostIn.common_data.TResC[i] * results.RT_peak[day * NH * NGen + i * NH + t];
            }

            for (int i = 0; i < NHyd; i++) {
                metrics.generation_tertiary_reserve_revenue[i + NGen + NR] += results.RT_price[day * NH + t] * results.RT_hyd[day * NH * NHyd + i * NH + t];
                metrics.generation_tertiary_reserve_cost[i + NGen + NR] += ProdCostIn.common_data.TResCh[i] * results.RT_hyd[day * NH * NHyd + i * NH + t];
            }
        }
    }

    //double storage_energy_revenue=0;
    // storage energy revenue is calculated by discharging and charging of
    // ess, but for noess case, we should set it to zero?    
    for (int day = 0; day < NUMBER_OF_DAYS; day++) {
        for (int t = 0; t < NH; t++) {

            for (int i = 0; i < NS; i++) {
                metrics.storage_energy_revenue[i] += results.energyPrice[day * NH + t] * results.G_DS[day * NH * NS + i * NH + t];
            }

        }
    }

    for (int day = 0; day < NUMBER_OF_DAYS; day++) {
        for (int t = 0; t < NH; t++) {
            for (int i = 0; i < NS; i++) {
                metrics.storage_energy_revenue[i] += -results.energyPrice[day * NH + t] * results.G_CS[day * NH * NS + i * NH + t];
            }
        }
    }

    //    double storage_primary_reserve_revenue=0; 
    for (int day = 0; day < NUMBER_OF_DAYS; day++) {
        for (int t = 0; t < NH; t++) {
            for (int i = 0; i < NS; i++) {
                metrics.storage_primary_reserve_revenue[i] += results.RP_price[day * NH + t] * results.RP_sto[day * NH * NS + i * NH + t];
                metrics.storage_primary_reserve_cost[i] += ProdCostIn.common_data.PResCs[i] * results.RP_sto[day * NH * NS + i * NH + t];
            }
        }
    }

    //    double storage_secondary_reserve_revenue=0;
    for (int day = 0; day < NUMBER_OF_DAYS; day++) {
        for (int t = 0; t < NH; t++) {
            for (int i = 0; i < NS; i++) {
                metrics.storage_secondary_reserve_revenue[i] += results.RS_price[day * NH + t] * results.RS_sto[day * NH * NS + i * NH + t];
                metrics.storage_secondary_reserve_cost[i] += ProdCostIn.common_data.SResCs[i] * results.RS_sto[day * NH * NS + i * NH + t];
            }
        }
    }

    //    double storage_tertiary_reserve_revenue=0;   
    for (int day = 0; day < NUMBER_OF_DAYS; day++) {
        for (int t = 0; t < NH; t++) {
            for (int i = 0; i < NS; i++) {
                metrics.storage_tertiary_reserve_revenue[i] += results.RT_price[day * NH + t] * results.RT_sto[day * NH * NS + i * NH + t];
                metrics.storage_tertiary_reserve_cost[i] += ProdCostIn.common_data.TResCs[i] * results.RT_sto[day * NH * NS + i * NH + t];
            }
        }
    }

    //PC generation: day & energyPrice   


    // ////////Do metric///////////////////


    delete results.energyPrice;
    delete results.RP_price;
    delete results.RS_price;
    delete results.RT_price;
    qDebug() << "Therm generation size: " << results.G_peak.size();
    results.G_peak.clear();
    results.G_exist.clear();
    results.DR_up.clear();
    results.DR_dn.clear();
    results.G_ren.clear();
    results.G_H.clear();
    results.G_CS.clear();
    results.G_DS.clear();
    results.E_ST.clear();
    results.RP_peak.clear();
    results.RS_peak.clear();
    results.RT_peak.clear();
    results.RP_sto.clear();
    results.RS_sto.clear();
    results.RT_sto.clear();
    results.RP_hyd.clear();
    results.RS_hyd.clear();
    results.RT_hyd.clear();
    delete PRCost;
    delete SRCost;
    delete TRCost;
    delete VCDF;
    delete VCRF;
    delete VCHF;
    delete PRCostHyd;
    delete SRCostHyd;
    delete TRCostHyd;
    delete VCSF;
    delete Lower_Bounds;
    delete Upper_Bounds;



    try {

        //Write installed ESS power capacity
        pstmt = con->prepareStatement("DELETE FROM production_cost_output_files WHERE ess_or_noess = 0 AND scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id));
        res = pstmt->executeQuery();
        //INSERT
        delete pstmt;
        delete res;
        pstmt = con->prepareStatement("INSERT INTO production_cost_output_files(PC_generation,PC_enerprice,PC_primres,PC_resprice,PC_secres,PC_tertres,ess_or_noess,scenario_and_cases_row_id) VALUES (?,?,?,?,?,?,?,?)");
        pstmt->setString(1, GenFileName);
        pstmt->setString(2, EPFileName);
        pstmt->setString(3, PRFileName);
        pstmt->setString(4, RPFileName);
        pstmt->setString(5, SRFileName);
        pstmt->setString(6, TRFileName);
        pstmt->setBoolean(7, 0); //Noess is 0
        pstmt->setInt(8, scenario_and_cases_row_id);
        pstmt->executeUpdate();
        delete pstmt;

        // metric into database KAI
        //int generator=2;
        int separator, separator2 = 0;

        std::string generator_string = "";

        for (int generator = 0; generator < 12; generator++) {
            qDebug() << " >> create object for pstmt and res: " << generator;
            if (generator >= 0 && generator < NGen) generator_string = thermtype[generator];
            if (generator_string == "Natural Gas") generator_string += std::to_string(separator++);
            if (generator_string == "Heavy Fuel Oil (HFO)") generator_string += std::to_string(separator2++);
            if (generator == NGen) generator_string = "wind";
            if (generator == NGen + 1)generator_string = "solar";
            if (generator == NGen + NR)generator_string = "hydro";

            qDebug() << (" Got the name of generator " + generator_string).c_str();

            // std::string generator_string= thermtype[generator];
            pstmt = con->prepareStatement("DELETE FROM generator_calculated_metrics "
                    "WHERE scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id)
                    + " and generator = ? and ess_or_noess = 0  ");
            pstmt->setString(1, generator_string);
            res = pstmt->executeQuery();
            qDebug() << " >> DELETE FROM generator_calculated_metrics for generator" << generator;
            //           
            //            
            //            if (res->next()) {
            //                //UPDATE
            //                qDebug() << " delete the objects for update statement ";
            //                delete res;
            //                delete pstmt;
            //                //delete con;
            //                
            //                pstmt = con->prepareStatement("UPDATE generator_calculated_metrics SET fuel_cost=?,vom_cost=?,"
            //                         "generation_energy_revenue=?,"
            //                         "generation_primary_reserve_revenue=?,"
            //                         " generation_secondary_reserve_revenue=?"
            //                         " ,generation_tertiary_reserve_revenue=? "
            ////                         ",storage_energy_revenue=?,"
            ////                        " storage_primary_reserve_revenue=?, "
            ////                         "storage_secondary_reserve_revenue=?"
            ////                        ", storage_tertiary_reserve_revenue=? "
            //                         ",fom_cost=? "
            //                        " ,ess_or_noess=? "
            //                       ", generator=?  "
            //                        "WHERE scenario_and_cases_row_id=?");
            //                
            //                
            //                pstmt->setDouble(1, metrics.fuel_cost[generator]);
            //                pstmt->setDouble(2, metrics.vom_cost[generator]);
            //                pstmt->setDouble(3, metrics.generation_energy_revenue [generator]);
            //                pstmt->setDouble(4, metrics.generation_primary_reserve_revenue [generator]);
            //                pstmt->setDouble(5, metrics.generation_secondary_reserve_revenue [generator]);
            //                pstmt->setDouble(6, metrics.generation_tertiary_reserve_revenue [generator]);  
            ////                pstmt->setDouble(7, storage_energy_revenue [generator]);
            ////                pstmt->setDouble(8, storage_primary_reserve_revenue [generator]);
            ////                pstmt->setDouble(9, storage_secondary_reserve_revenue [generator]);
            ////                pstmt->setDouble(10, storage_tertiary_reserve_revenue [generator]);
            //                pstmt->setDouble(7, metrics.fom_cost[generator]);
            //                
            //                pstmt->setBoolean(8,0 );// noess is zero 
            //                pstmt->setString(9,generator_string  );
            //                pstmt->setInt(10, scenario_and_cases_row_id);
            //                pstmt->executeUpdate();
            //                 qDebug()  << " >>update  generator_calculated_metrics for generator"<< generator ;
            //            delete pstmt;
            //            //delete con;

            //            } else {
            //INSERT
            //                 qDebug() << " delete the object for INSERT statement ";
            //                delete res;
            //                delete pstmt;
            //delete con;
            sql::PreparedStatement *pstmt;
            pstmt = con->prepareStatement("INSERT INTO generator_calculated_metrics"
                    "(fuel_cost,vom_cost,generation_energy_revenue,"
                    "generation_primary_reserve_revenue,"
                    "generation_secondary_reserve_revenue,"
                    "generation_tertiary_reserve_revenue,"
                    "generation_primary_reserve_cost,"
                    "generation_secondary_reserve_cost,"
                    "generation_tertiary_reserve_cost,"
                    //                         "storage_energy_revenue,"
                    //                         "storage_primary_reserve_revenue,"
                    //                         " storage_secondary_reserve_revenue,"
                    //                         "storage_tertiary_reserve_revenue,"
                    " fom_cost, "
                    "ess_or_noess,"
                    " generator, "
                    "scenario_and_cases_row_id, "
                    "year_id ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
            pstmt->setDouble(1, metrics.fuel_cost[generator]);
            pstmt->setDouble(2, metrics.vom_cost[generator]);
            pstmt->setDouble(3, metrics.generation_energy_revenue[generator]);
            pstmt->setDouble(4, metrics.generation_primary_reserve_revenue[generator]);
            pstmt->setDouble(5, metrics.generation_secondary_reserve_revenue[generator]);
            pstmt->setDouble(6, metrics.generation_tertiary_reserve_revenue[generator]);
            pstmt->setDouble(7, metrics.generation_primary_reserve_cost[generator]);
            pstmt->setDouble(8, metrics.generation_secondary_reserve_cost[generator]);
            pstmt->setDouble(9, metrics.generation_tertiary_reserve_cost[generator]);
            pstmt->setDouble(10, metrics.fom_cost[generator]);
            pstmt->setBoolean(11, 0);
            pstmt->setString(12, generator_string);
            pstmt->setInt(13, scenario_and_cases_row_id);
            pstmt->setInt(14, 1);
            pstmt->executeUpdate();
            qDebug() << " >>insert  generator_calculated_metrics for generator" << generator;
            delete pstmt;
            //delete con;
            //            }
            qDebug() << " >> delete the res and pstmt now and go back to loop :" << generator;

            //new loop
        }
        //Storage metrics
        for (int generator = 0; generator < NS; generator++) {
            qDebug() << " >> create object for pstmt and res: " << generator;
            generator_string = stotype[generator];
            qDebug() << (" Got the name of generator " + generator_string).c_str();

            pstmt = con->prepareStatement("DELETE FROM generator_calculated_metrics "
                    "WHERE scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id)
                    + " and generator = ? and ess_or_noess = 0  ");
            pstmt->setString(1, generator_string);
            res = pstmt->executeQuery();
            qDebug() << " >> DELETE FROM generator_calculated_metrics for storage" << generator;

            //INSERT
            qDebug() << " delete the object for INSERT statement ";
            delete res;
            delete pstmt;
            //delete con;
            sql::PreparedStatement *pstmt;
            pstmt = con->prepareStatement("INSERT INTO generator_calculated_metrics"
                    "(vom_cost,"
                    "storage_energy_revenue,"
                    "storage_primary_reserve_revenue,"
                    "storage_secondary_reserve_revenue,"
                    "storage_tertiary_reserve_revenue,"
                    "storage_primary_reserve_cost,"
                    "storage_secondary_reserve_cost,"
                    "storage_tertiary_reserve_cost,"
                    "fom_cost,"
                    "ess_or_noess,"
                    "generator,"
                    "scenario_and_cases_row_id, "
                    "year_id ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
            pstmt->setDouble(1, metrics.voms_cost[generator]);
            pstmt->setDouble(2, metrics.storage_energy_revenue[generator]);
            pstmt->setDouble(3, metrics.storage_primary_reserve_revenue[generator]);
            pstmt->setDouble(4, metrics.storage_secondary_reserve_revenue[generator]);
            pstmt->setDouble(5, metrics.storage_tertiary_reserve_revenue[generator]);
            pstmt->setDouble(6, metrics.storage_primary_reserve_cost[generator]);
            pstmt->setDouble(7, metrics.storage_secondary_reserve_cost[generator]);
            pstmt->setDouble(8, metrics.storage_tertiary_reserve_cost[generator]);
            pstmt->setDouble(9, metrics.foms_cost[generator]);
            pstmt->setBoolean(10, 0);
            pstmt->setString(11, generator_string);
            pstmt->setInt(12, scenario_and_cases_row_id);
            pstmt->setInt(13, 1);
            pstmt->executeUpdate();
            qDebug() << " >>insert  generator_calculated_metrics for storage" << generator;
            delete pstmt;
            //delete con;
            qDebug() << " >> delete the res and pstmt now and go back to loop :" << generator;
            //new loop
        }
        pstmt = con->prepareStatement("DELETE FROM fuel_usage_output_installed_noess_tables WHERE scenario_and_cases_row_id = " + std::to_string(scenario_and_cases_row_id));
        res = pstmt->executeQuery();
        delete res;
        delete pstmt;
        separator=0;
        separator2=0;
        qDebug() << " >> DELETE FROM fuel_usage_output_installed_noess_tables ";
        for (int generator = 0; generator < NGen; generator++) {
            generator_string = thermtype[generator];
            if (generator_string == "Natural Gas") generator_string += std::to_string(separator++);
            if (generator_string == "Heavy Fuel Oil (HFO)") generator_string += std::to_string(separator2++);

            qDebug() << (" Got the name of generator " + generator_string).c_str();

            //INSERT
            qDebug() << " delete the object for INSERT statement ";
            //delete con;
            sql::PreparedStatement *pstmt;
            pstmt = con->prepareStatement("INSERT INTO fuel_usage_output_installed_noess_tables(outfuelburn1,outco2em1,thermtype,scenario_and_cases_row_id) VALUES (?,?,?,?)");
            pstmt->setDouble(1, metrics.fuel_burn[generator]);
            pstmt->setDouble(2, metrics.emissions[generator]);
            pstmt->setString(3, generator_string);
            pstmt->setInt(4, scenario_and_cases_row_id);
            pstmt->executeUpdate();
            qDebug() << " >>insert  generator_calculated_metrics for generator" << generator;
            delete pstmt;
            //delete con;
            qDebug() << " >> delete the res and pstmt now and go back to loop :" << generator;
            //new loop
        }


    } catch (sql::SQLException &e) {
        qDebug() << " sql error catch!";
        std::cout << "# ERR: SQLException in " << __FILE__;
        std::cout << "(" << __FUNCTION__ << ") on line " << __LINE__ << std::endl;
        std::cout << "# ERR: " << e.what();
        std::cout << " (MySQL error code: " << e.getErrorCode();
        std::cout << ", SQLState: " << e.getSQLState() << " )" << std::endl;
        std::string query2("UPDATE scenarios_and_cases SET production_cost_calculation_noess_status = 'ERROR_QUERY', production_cost_calculation_noess_date =CURRENT_TIMESTAMP() WHERE row_id = ?;");
        pstmt = con->prepareStatement(query2);
        pstmt->setInt(1, scenario_and_cases_row_id);
        pstmt->execute();
        delete pstmt;
        delete con;

        return 0;
    }

    //qDebug() << "Not normal days: "<<not_normal[0];
    //qDebug() << "status: " << not_normal_status[0];
    std::string query2("UPDATE scenarios_and_cases SET production_cost_calculation_noess_status = 'COMPLETE', production_cost_calculation_date =CURRENT_TIMESTAMP() WHERE row_id = ?;");
    qDebug() << " UPDATE scenarios_and_cases! the end";
    pstmt = con->prepareStatement(query2);
    pstmt->setInt(1, scenario_and_cases_row_id);
    pstmt->execute();
    delete pstmt;
    delete con;

    return 0; //status;
}

//

int ProductionCostThreadNoEss::ThreadSleep(int sleepTime) {
    qDebug() << this << " >> Reset locking";
    this->msleep(sleepTime);
    return 1;

}
