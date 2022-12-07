import { Component, OnInit } from '@angular/core';
import { GetDataService } from 'src/services/getData/get-data.service';
import { SearchBiomarkersService } from 'src/services/searchBiomarkers/search-biomarkers.service';
import { Biomarkers, PatientConnector, SelectedAll } from './patient-connector-table.interface';

@Component({
  selector: 'app-patient-component-table',
  templateUrl: './patient-component-table.component.html',
  styleUrls: ['./patient-component-table.component.scss']
})
export class PatientComponentTableComponent implements OnInit {
  biomarkers: Biomarkers[] = [];
  selected: any = "disease";
  clickedBiomarker: string = "";
  selectedAll: SelectedAll[] = [];
  checkedAll: boolean = false;
  inputValue = "";
  copyArray: Biomarkers[] = [];
  count: number = 0;
  pages:Array<number> =[];
  pageSelected:number = 0; 
  constructor(private getDataService:GetDataService,
              private searchBiomarkersService:SearchBiomarkersService,
              
              ) { }

  ngOnInit(): void {

    this.copyArray = this.getDataService.getData();
    this.biomarkers = this.copyArray.slice(0,5);
    this.pages = new Array<number>(Math.ceil(( this.copyArray.length ) / 5));
    this.searchBiomarkersService.searchBiomarkers.subscribe((biomarkers:Biomarkers[]) =>{
      this.biomarkers = biomarkers;
    })
    this.searchBiomarkersService.selectBiomarkers.subscribe((selected:String) =>{

      this.selected = selected;
    })

  }    
  getChekMarkSelected(biomarker: Biomarkers) {

    return this.selected === biomarker.biomarkerType && biomarker.selected;

  }
  getBiomarkerType(biomarker: Biomarkers): string {
    return biomarker.biomarkerType;

  }
  selectTheBiomarker(biomarker: Biomarkers) {
    biomarker.selected = !biomarker.selected
  }
  getCheckBoxBackGroundSelected(biomarker: Biomarkers) {
    return biomarker.selected;
  }
  getCheckBoxBackGroundNotSelected(biomarker: Biomarkers) {
    return !biomarker.selected
  }
  selectAllBiomarkersdisplay(selectedAll: boolean) {
    this.biomarkers = this.biomarkers.map((e: any) => {

      if (this.selected === e.biomarkerType)
        e.selected = !selectedAll;
      return e;
    })
    this.selectedAll = this.selectedAll.map((e: SelectedAll, index: number) => {
      if (this.selectedAll.find((e: any) => e.selectedType === this.selected) === undefined) {
        e.selectedType = this.selected;
        e.checked = !selectedAll
        this.checkedAll = !selectedAll
        return e;
      }
      if (this.selected === e.selectedType && e.checked === selectedAll) {
        e.checked = !selectedAll;
        this.checkedAll = !selectedAll
        return e;
      }
      if (this.selected === e.selectedType && e.checked !== selectedAll) {
        e.checked = selectedAll;
        this.checkedAll = selectedAll
        return e;
      }
      return e;
    })
    if (this.selectedAll.length <= 0) {
      this.selectedAll.push({
        selectedType: this.selected,
        checked: !selectedAll

      }
      )
      this.checkedAll = !selectedAll;
    }


  }
  pageClicked(index:any){
    this.biomarkers = this.copyArray.slice( (5 * index ),5);
    this.pageSelected = index;
    
  }

}
