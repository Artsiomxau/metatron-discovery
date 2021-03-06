/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as _ from 'lodash';
import { Component, ElementRef, EventEmitter, Injector, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import {
  Candidate, InclusionFilter,
  InclusionSelectorType
} from '../../../domain/workbook/configurations/filter/inclusion-filter';
import { Field, FieldRole } from '../../../domain/datasource/datasource';
import { CustomField } from '../../../domain/workbook/configurations/field/custom-field';
import { Alert } from '../../../common/util/alert.util';
import {
  InequalityType,
  MeasureInequalityFilter
} from '../../../domain/workbook/configurations/filter/measure-inequality-filter';
import {
  MeasurePositionFilter,
  PositionType
} from '../../../domain/workbook/configurations/filter/measure-position-filter';
import { ContainsType, WildCardFilter } from '../../../domain/workbook/configurations/filter/wild-card-filter';
import { AggregationType } from '../../../domain/workbook/configurations/field/measure-field';
import { AdvancedFilter } from '../../../domain/workbook/configurations/filter/advanced-filter';
import { Dashboard } from '../../../domain/dashboard/dashboard';
import { FilterUtil } from '../../util/filter.util';
import { DatasourceService } from '../../../datasource/service/datasource.service';
import { AbstractFilterPopupComponent } from '../abstract-filter-popup.component';
import { StringUtil } from '../../../common/util/string.util';

@Component({
  selector: 'app-config-filter-inclusion',
  templateUrl: './configure-filters-inclusion.component.html'
})
export class ConfigureFiltersInclusionComponent extends AbstractFilterPopupComponent implements OnInit, OnDestroy {

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Private Variables
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  @ViewChild('inputSearch')
  private _inputSearch: ElementRef;

  @ViewChild('inputNewCandidateValue')
  private _inputNewCandidateValue: ElementRef;

  // 후보군 리스트
  private _candidateList: Candidate[] = [];

  // 대시보드 정보
  private _board: Dashboard;

  // 선택 정보
  private _selectedValues: Candidate[] = [];   // 기본 선택 값 목록
  private _candidateValues: Candidate[] = [];  // 기본 선택 값 목록

  // 대상 필드 정보
  private _targetField: Field | CustomField;

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Protected Variables
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Public Variables
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  public isShow: boolean = false;   // 컴포넌트 표시 여부
  public isOnlyShowCandidateValues: boolean = false;   // 표시할 후보값만 표시 여부

  // 수정 대상
  public targetFilter: InclusionFilter;

  // 페이징 관련
  public pageCandidateList: Candidate[] = [];
  public currentPage: number = 1;
  public lastPage: number = 1;
  public pageSize: number = 15;
  public totalCount: number = 0;
  public totalItemCnt: number = 0;

  // 검색 관련
  public searchText: string = '';

  // 필터링 관련
  public condition: MeasureInequalityFilter;
  public limitation: MeasurePositionFilter;
  public wildcard: WildCardFilter;
  public measureFields: Field[] = [];

  @Output()
  public goToSelectField: EventEmitter<any> = new EventEmitter();

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Constructor
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  // 생성자
  constructor(private datasourceService: DatasourceService,
              protected elementRef: ElementRef,
              protected injector: Injector) {
    super(elementRef, injector);
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Override Method
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  // Init
  public ngOnInit() {
    super.ngOnInit();
  }

  // Destroy
  public ngOnDestroy() {
    super.ngOnDestroy();
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Public Method
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  /**
   * 컴포넌트를 표시한다.
   * @param {Dashboard} board
   * @param {InclusionFilter} targetFilter
   * @param {Field | CustomField} targetField
   */
  public showComponent(board: Dashboard, targetFilter: InclusionFilter, targetField?: (Field | CustomField)) {
    // 데이터 설정
    const preFilterData = {
      aggregationType: this.aggregationTypeList[0],
      limitType: this.limitTypeList[0],
      conditionType: this.conditionTypeList[0],
      wildCardType: this.wildCardTypeList[0]
    };

    this.measureFields = board.configuration.fields.filter(item => {
      return item.role === FieldRole.MEASURE && 'user_expr' !== item.type;
    });

    const defaultData: InclusionFilter
      = FilterUtil.getBasicInclusionFilter(<Field>targetField, true, targetFilter.ui.importanceType, preFilterData);

    if (targetFilter.preFilters) {
      // lodash merge가 deepMerge 가 잘 되지 않아서 별도로 하위 데이터를 직접 합쳐줌
      targetFilter.preFilters = targetFilter.preFilters.map((data: AdvancedFilter) => {
        const defaultPreFilter: AdvancedFilter
          = defaultData.preFilters.find((defaultPreFilter: AdvancedFilter) => data.type === defaultPreFilter.type);
        return _.merge(defaultPreFilter, data);
      });
    } else {
      targetFilter.preFilters = defaultData.preFilters;
    }
    targetFilter = _.merge({}, defaultData, targetFilter);

    targetFilter.preFilters.forEach((preFilter: AdvancedFilter) => {
      if (preFilter.type === 'measure_inequality') {
        this.condition = <MeasureInequalityFilter>preFilter;
      } else if (preFilter.type === 'measure_position') {
        this.limitation = <MeasurePositionFilter>preFilter;
      } else if (preFilter.type === 'wildcard') {
        this.wildcard = <WildCardFilter>preFilter;
      }
    });

    // 값 정보 설정
    if (targetFilter.valueList && 0 < targetFilter.valueList.length) {
      this._selectedValues = targetFilter.valueList.map(item => this._stringToCandidate(item));
      ( 1 < this._selectedValues.length ) && ( targetFilter.selector = InclusionSelectorType.MULTI_LIST );
    }
    if (targetFilter.candidateValues && 0 < targetFilter.candidateValues.length) {
      this._candidateValues = targetFilter.candidateValues.map(item => this._stringToCandidate(item));
    }
    if (targetFilter.definedValues && 0 < targetFilter.definedValues.length) {
      this._candidateList = targetFilter.definedValues.map(item => this._stringToCandidate(item, true));
    }

    this.loadingShow();
    this.datasourceService.getCandidateForFilter(targetFilter, board, [], targetField).then(result => {
      this._setCandidateResult(result, targetFilter, targetField);
      this.targetFilter = targetFilter;
      this._targetField = targetField;
      this._board = board;
      this.isShow = true;
      this.safelyDetectChanges();
      this.loadingHide();
    }).catch(err => this.commonExceptionHandler(err));

  } // function - showComponent

  /**
   * 현재 설정된 정보를 반환한다.
   * @return {InclusionFilter}
   */
  public getData(): InclusionFilter {
    const filter: InclusionFilter = this.targetFilter;
    filter.valueList = this._selectedValues.map(item => item.name);
    filter.candidateValues = this._candidateValues.map(item => item.name);
    filter.definedValues = this._candidateList.filter(item => item.isDefinedValue).map(item => item.name);
    return filter;
  } // function - getData

  // noinspection JSMethodCanBeStatic
  /**
   * 단일 선택 여부를 반환한다
   * @param {InclusionFilter} targetFilter
   * @return {boolean}
   */
  public isSingleSelect(targetFilter: InclusionFilter): boolean {
    return InclusionSelectorType.SINGLE_LIST === targetFilter.selector || InclusionSelectorType.SINGLE_COMBO === targetFilter.selector;
  } // function - isSingleSelect

  /**
   * 선택 형식을 결정한다
   * @param {InclusionFilter} targetFilter
   * @param {string} type
   */
  public setSelectorType(targetFilter: InclusionFilter, type: string) {
    if ('SINGLE' === type) {
      if (this._isListSelector(targetFilter)) {
        targetFilter.selector = InclusionSelectorType.SINGLE_LIST;
      } else {
        targetFilter.selector = InclusionSelectorType.SINGLE_COMBO;
      }
      if( 1 < this._selectedValues.length ) {
        this._selectedValues = [this._selectedValues[0]];
        this.safelyDetectChanges();
      }
    } else {
      if (this._isListSelector(targetFilter)) {
        targetFilter.selector = InclusionSelectorType.MULTI_LIST;
      } else {
        targetFilter.selector = InclusionSelectorType.MULTI_COMBO;
      }
    }
  } // function - setSelectorType

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Public Method - 검색 관련
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /**
   * 검색어 리셋
   */
  public resetSearchText(isClear: boolean) {
    if (isClear) {
      this._inputSearch.nativeElement.value = '';
    } else {
      // 검색어 설정
      this._inputSearch.nativeElement.value = this.searchText;
    }
  } // function - resetSearchText

  /**
   * 검색 조회
   */
  public searchEvent() {
    this.searchText = this._inputSearch.nativeElement.value;    // 검색어 설정
    this.setCandidatePage(1, true);
  } // function - searchEvent

  /**
   * 검색 조회 - 키보드 이벤트
   * @param {KeyboardEvent} event
   */
  public searchEventPressKey(event: KeyboardEvent) {
    (13 === event.keyCode) && (this.searchEvent());
  } // function - searchEventPressKey

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Public Method - 필터링 관련
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /**
   * 와일드 카드의 값을 초기화 시킨다.
   */
  public resetWildcard(filter: WildCardFilter) {
    filter.contains = ContainsType.BEFORE;
    filter.containsUI = this.wildCardTypeList[0];
    filter.value = '';
  } // function resetWildcard

  /**
   * condition의 값을 초기화 시킨다.
   */
  public resetCondition(filter: MeasureInequalityFilter) {
    filter.aggregationType = AggregationType.SUM;
    filter.aggregationTypeUI = this.aggregationTypeList[0];
    filter.inequality = InequalityType.EQUAL_TO;
    filter.inequalityUI = this.conditionTypeList[0];
    filter.value = 10;
    filter.fieldUI = null;
  } // function resetCondition

  /**
   * Limit의 값을 초기화 시킨다.
   */
  public resetLimitation(filter: MeasurePositionFilter) {
    filter.aggregationType = AggregationType.SUM;
    filter.aggregationTypeUI = this.aggregationTypeList[0];
    filter.position = PositionType.TOP;
    filter.positionUI = this.conditionTypeList[0];
    filter.value = 10;
    filter.fieldUI = null;
  } // function resetLimitation

  /**
   * 위 3개의 조건을 모두 초기화 시킨다.
   */
  public resetAll() {
    this.resetWildcard(this.wildcard);
    this.resetCondition(this.condition);
    this.resetLimitation(this.limitation);
  } // function resetAll

  /**
   * validation 체크이후에 candidate 호출
   */
  public candidateWithValidation() {
    // validation
    if (this._isInvalidFiltering()) {
      return;
    }
    this.datasourceService.getCandidateForFilter(this.targetFilter, this._board, [], this._targetField).then(result => {
      this._setCandidateResult(result, this.targetFilter, this._targetField);
      this.safelyDetectChanges();
      this.loadingHide();
    });
  } // function - candidateWithValidation

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Public Method - 목록 정렬 관련
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /**
   * 후보값을 정렬한다.
   * @param {InclusionFilter} filter
   * @param {string} target
   * @param {string} type
   */
  public sortCandidateValues(filter: InclusionFilter, target: string, type: string) {
    // 정렬 정보 저장
    filter['sortTarget'] = target;
    filter['sortType'] = type;

    // 데이터 정렬
    const allCandidates: Candidate[] = _.cloneDeep(this._candidateList);
    if ('FREQUENCY' === target) {
      // value 기준으로 정렬
      allCandidates.sort((val1: Candidate, val2: Candidate) => {
        return ('ASC' === type) ? val1.count - val2.count : val2.count - val1.count;
      });
    } else {
      // name 기준으로 정렬
      allCandidates.sort((val1: Candidate, val2: Candidate) => {
        const name1: string = ( val1.name ) ? val1.name.toUpperCase() : '';
        const name2: string = ( val2.name ) ? val2.name.toUpperCase() : '';
        if (name1 < name2) {
          return ('ASC' === type) ? -1 : 1;
        }
        if (name1 > name2) {
          return ('ASC' === type) ? 1 : -1;
        }
        return 0;
      });
    }
    this._candidateList = allCandidates;

    // 페이징 초기화
    this.setCandidatePage(1, true);
  } // function - sortCandidateValues

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Public Method - 목록 페이징 관련
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /**
   * candidate list 페이징
   * @param {number} page
   * @param {boolean} isInitial
   */
  public setCandidatePage(page: number, isInitial: boolean = false) {

    if (isInitial) {
      this.pageCandidateList = [];
      this.currentPage = 1;
      this.lastPage = 1;
      this.totalCount = 0;
    }

    // 더이상 페이지가 없을 경우 리턴
    if (page <= 0) return;
    if (this.lastPage < page) return;

    this.currentPage = page;
    let start = 0;
    let end = 0;

    // 필드 페이징
    if (this._candidateList && 0 < this._candidateList.length) {

      let pagedList: Candidate[] = _.cloneDeep(this._candidateList);

      // 검색 적용
      if ('' !== this.searchText) {
        pagedList = pagedList.filter(item => -1 < item.name.toLowerCase().indexOf(this.searchText.toLowerCase()));
      }

      // 표시 여부 적용
      if (this.isOnlyShowCandidateValues) {
        pagedList = pagedList.filter(item => this.isShowItem(item));
      }

      // 총사이즈
      this.totalCount = pagedList.length;

      // 마지막 페이지 계산
      this.lastPage = (this.totalCount % this.pageSize === 0) ? (this.totalCount / this.pageSize) : Math.floor(this.totalCount / this.pageSize) + 1;

      start = (page * this.pageSize) - this.pageSize;
      end = (page * this.pageSize) - 1;
      if (end > this.totalCount) {
        end = this.totalCount;
      }
      // 현재 페이지에 맞게 데이터 자르기
      this.pageCandidateList = pagedList.slice(start, end);
    }
  } // function - setCandidatePage

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Public Method - 목록 아이템 관련
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  /**
   * 전체 선택
   * @param event
   */
  public candidateSelectAll(event:any) {
    const checked = event.target ? event.target.checked : event.currentTarget.checked;
    if( this.isSingleSelect(this.targetFilter) ) {
      this._selectedValues = [];
    } else {
      if (checked) {
        this._selectedValues = _.cloneDeep( this._candidateList );
      } else {
        this._selectedValues = [];
      }
    }
  } // function - candidateSelectAll

  /**
   * 전체 선택 여부
   * @return {boolean}
   */
  public isCheckedAllItem():boolean {
    if( this.isSingleSelect(this.targetFilter) ) {
      return 0 === this._selectedValues.length
    } else {
      return this._candidateList.length === this._selectedValues.length;
    }
  } // function - isCheckedAllItem

  /**
   * 선택된 아이템 여부
   * @param {Candidate} listItem
   * @return {boolean}
   */
  public isCheckedItem(listItem: Candidate): boolean {
    return -1 < this._selectedValues.findIndex(item => item.name === listItem.name);
  } // function - isCheckedItem

  /**
   * 표시 아이템 여부
   * @param {Candidate} listItem
   * @return {boolean}
   */
  public isShowItem(listItem: Candidate): boolean {
    return -1 < this._candidateValues.findIndex(item => item.name === listItem.name);
  } // function - isShowItem

  /**
   * 후보군 값 선택
   * @param {Candidate} item
   * @param $event
   */
  public candidateSelect(item: Candidate, $event?: any) {
    const filter: InclusionFilter = this.targetFilter;
    if (this.isSingleSelect(filter)) {
      // 싱글 리스트
      this._selectedValues = [item];
    } else {
      // 멀티 리스트
      const checked = $event.target ? $event.target.checked : $event.currentTarget.checked;
      if (checked) {
        this._selectedValues.push(item);
      } else {
        _.remove(this._selectedValues, { name: item.name });
      }
    }
  } // function - candidateSelect

  /**
   * 선별값만 보임 여부 설정
   */
  public setOnlyShowCandidateValues() {
    this.isOnlyShowCandidateValues = !this.isOnlyShowCandidateValues;
    this.setCandidatePage(1, true);
  } // function - setOnlyShowCandidateValues

  /**
   * 눈표시
   * param { Candidate } item
   */
  public candidateShowToggle(item: Candidate) {
    if (this.isShowItem(item)) {
      _.remove(this._candidateValues, { name: item.name });
    } else {
      this._candidateValues.push(item);
    }

    if (this.isOnlyShowCandidateValues) {
      this.setCandidatePage(1, true);
    }
  } // function candidateShowToggle

  /**
   * 후보군에 사용자 입력값 제거
   * @param {string} item
   */
  public deleteDefinedValue(item: Candidate) {
    _.remove(this._candidateList, { name: item.name });
    this.setCandidatePage(1, true);
  } // function deleteDefinedValue

  /**
   * 사용자 정의 값 입력 초기화
   */
  public clearInputNewCandidateValue() {
    this._inputNewCandidateValue.nativeElement.value = '';
  } // function - clearInputNewCandidateValue

  /**
   * 사용자 정의 값 추가
   */
  public addNewCandidateValue() {
    const newCandidateValue: string = this._inputNewCandidateValue.nativeElement.value;    // 검색어 설정

    if (null === newCandidateValue || newCandidateValue.trim().length === 0) {
      Alert.warning(this.translateService.instant('msg.board.filter.alert.defined.empty'));
      return;
    }

    // 데이터 추가
    this._candidateList.push(this._stringToCandidate(newCandidateValue, true));

    this.setCandidatePage(1, true);
    this.clearInputNewCandidateValue();
  } // function - addNewCandidateValue

  /**
   * 사용자 정의 값 추가 - 키보드 이벤트
   * @param {KeyboardEvent} event
   */
  public addNewCandidateValuePressKey(event: KeyboardEvent) {
    (13 === event.keyCode) && (this.addNewCandidateValue());
  } // function - addNewCandidateValuePressKey

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Protected Method
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Private Method
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /**
   * 유효하지 않은 필터링 조건 체크
   */
  private _isInvalidFiltering(): boolean {

    // wildcard 50자 제한
    if (this.wildcard.value && this.wildcard.value.length > 50) {
      Alert.info(this.translateService.instant('msg.board.general.filter.common.maxlength', { value: 50 }));
      return true;
    }

    // condition 빈값일때 default 10값 넣어주기
    if (_.isEmpty(this.condition.value)) {
      this.condition.value = 10;
    }

    // condition 19자 제한
    if (this.condition.value && this.condition.value.toString().length > 19) {
      Alert.info(this.translateService.instant('msg.board.general.filter.common.maxlength', { value: 19 }));
      return true;
    }

    // limitation 빈값일때 default 10값 넣어주기
    if (_.isEmpty(this.limitation.value)) {

      this.limitation.value = 10;
    }

    // limitation 10자 제한
    if (this.limitation.value && this.limitation.value.toString().length > 10) {
      Alert.info(this.translateService.instant('msg.board.general.filter.common.maxlength', { value: 10 }));
      return true;
    }

    return false;
  } // function - _isInvalidFiltering

  /**
   * Candidate 결과 처리
   * @param result
   * @param {InclusionFilter} targetFilter
   * @param {Field|CustomField} targetField
   * @private
   */
  private _setCandidateResult(result: any[], targetFilter: InclusionFilter, targetField: (Field | CustomField)) {
    this._candidateList = this._candidateList.filter(item => item.isDefinedValue);

    result.forEach((item) => this._candidateList.push(this._objToCandidate(item, targetField)));
    this.totalItemCnt = this._candidateList.length;
    (targetFilter.candidateValues) || (targetFilter.candidateValues = []);

    // 정렬
    this.sortCandidateValues(targetFilter, 'ALPHNUMERIC', 'ASC');
  }// function - _setCandidateResult

  // noinspection JSMethodCanBeStatic
  /**
   * List 형식의 선택자 여부 반환
   * @param {InclusionFilter} targetFilter
   * @return {boolean}
   * @private
   */
  private _isListSelector(targetFilter: InclusionFilter): boolean {
    return InclusionSelectorType.SINGLE_LIST === targetFilter.selector || InclusionSelectorType.MULTI_LIST === targetFilter.selector;
  } // function - _isListSelector

  // noinspection JSMethodCanBeStatic
  /**
   * 객체를 후보값 객체로 변환
   * @param item
   * @param {Field|CustomField} field
   * @return {Candidate}
   * @private
   */
  private _objToCandidate(item: any, field: (Field | CustomField)): Candidate {
    const candidate = new Candidate();
    if (item.hasOwnProperty('field') && StringUtil.isNotEmpty( item['field' ] + '' ) ) {
      candidate.name = item['field'];
      candidate.count = item['count'];
    } else {
      candidate.name = item[field.name];
      candidate.count = item['count'];
    }
    return candidate;
  } // function - _objToCandidate

  // noinspection JSMethodCanBeStatic
  /**
   * 텍스트를 후보값 객체로 변환
   * @param {string} item
   * @param {boolean} isDefine
   * @return {Candidate}
   */
  private _stringToCandidate(item: string, isDefine: boolean = false): Candidate {
    const candidate = new Candidate();
    candidate.name = item;
    candidate.count = 0;
    candidate.isDefinedValue = isDefine;
    return candidate;
  } // function - _stringToCandidate

}
