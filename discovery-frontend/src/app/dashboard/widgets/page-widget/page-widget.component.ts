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

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  Input,
  OnDestroy,
  OnInit,
  SimpleChange,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import * as _ from 'lodash';
import * as Clipboard from 'clipboard';
import {
  BrushType,
  ChartMouseMode,
  LegendConvertType, ChartType, FunctionValidator, SPEC_VERSION
} from '../../../common/component/chart/option/define/common';
import { saveAs } from 'file-saver';
import { AbstractWidgetComponent } from '../abstract-widget.component';
import { PageWidget, PageWidgetConfiguration } from '../../../domain/dashboard/widget/page-widget';
import { ChartSelectInfo } from '../../../common/component/chart/base-chart';
import { UIOption } from '../../../common/component/chart/option/ui-option';
import { Alert } from '../../../common/util/alert.util';
import { DatasourceService } from '../../../datasource/service/datasource.service';
import { SearchQueryRequest } from '../../../domain/datasource/data/search-query-request';
import { Filter } from '../../../domain/workbook/configurations/filter/filter';
import { ImageService } from '../../../common/service/image.service';
import { WidgetService } from '../../service/widget.service';
import { AnalysisPredictionService } from '../../../page/component/analysis/service/analysis.prediction.service';
import { Widget } from '../../../domain/dashboard/widget/widget';
import { EventBroadcaster } from '../../../common/event/event.broadcaster';
import { FilterUtil } from '../../util/filter.util';
import { NetworkChartComponent } from '../../../common/component/chart/type/network-chart/network-chart.component';
import { BaseChart } from '../../../common/component/chart/base-chart';
import { DashboardPageRelation } from '../../../domain/dashboard/widget/page-widget.relation';
import { BoardConfiguration, LayoutMode } from '../../../domain/dashboard/dashboard';
import { GridChartComponent } from '../../../common/component/chart/type/grid-chart/grid-chart.component';
import { BarChartComponent } from '../../../common/component/chart/type/bar-chart/bar-chart.component';
import { LineChartComponent } from '../../../common/component/chart/type/line-chart/line-chart.component';
import { OptionGenerator } from '../../../common/component/chart/option/util/option-generator';
import {
  BoardSyncOptions, BoardWidgetOptions,
  WidgetShowType
} from '../../../domain/dashboard/dashboard.globalOptions';
import { DataDownloadComponent } from '../../../common/component/data-download/data.download.component';
import { CustomField } from '../../../domain/workbook/configurations/field/custom-field';
import { DashboardUtil } from '../../util/dashboard.util';
import { isNullOrUndefined } from 'util';
import { TimeListFilter } from '../../../domain/workbook/configurations/filter/time-list-filter';
import { TimeFilter } from '../../../domain/workbook/configurations/filter/time-filter';
import { Datasource, Field } from '../../../domain/datasource/datasource';

declare let $;

@Component({
  selector: 'page-widget',
  templateUrl: 'page-widget.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageWidgetComponent extends AbstractWidgetComponent implements OnInit, OnDestroy {

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Private Variables
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  @ViewChild('chart')
  private chart: BaseChart;

  @ViewChild('gridChart')
  private gridChart: GridChartComponent;

  @ViewChild(DataDownloadComponent)
  private _dataDownComp: DataDownloadComponent;

  // 프로세스 실행 여부
  private _isDuringProcess: boolean = false;

  // 실시간 데이터소스 조회 타이머
  private _interval: any;

  // 대시보드 영역 overflow 여부
  private _dashboardOverflow: string;

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Protected Variables
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  // 차트에서 사용하는 데이터
  protected resultData: any;

  // 그리드에서 사용하는 옵션 ({}을 넣게되면 차트를 그릴때 uiOption값이 없는데도 차트를 그리다가 오류가 발생하므로 제거하였음 by juhee)
  protected gridUiOption: UIOption;
  // protected gridUiOption: UIOption = {};

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Public Variables
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  public widget: PageWidget = new PageWidget();
  public parentWidget: Widget;

  public widgetConfiguration: PageWidgetConfiguration = new PageWidgetConfiguration();

  public chartType: string;

  public isMaximize = false;                // 최대 여부
  public mouseMode: string = 'SINGLE';     // 차트 마우스 모드

  public isUpdateRedraw: boolean = true;          // 다시그리는 새로고침
  public isShowHierarchyView: boolean = false;    // 차트 계층 표시 여부
  public isInvalidPivot: boolean = false;          // 선반정보를 확인해야 하는 경우
  public isShowNoData: boolean = false;           // No-Data 표시 여부
  public isError: boolean = false;                // 에러 상태 표시 여부
  public isShowDownloadPopup: boolean = false;    // 다운로드 팝업 표시 여부
  public duringDataDown: boolean = false;         // 데이터 다운로드 진행 여부ddp-list-selectbox
  public duringImageDown: boolean = false;        // 이미지 다운로드 진행 여부

  // Pivot 내 사용자 정의 컬럼 사용 여부
  public useCustomField: boolean = false;

  // 차트 기능 확인기
  public chartFuncValidator: FunctionValidator = new FunctionValidator();

  // 데이터 조회 쿼리
  public query: SearchQueryRequest;

  get uiOption(): UIOption {
    return this.widgetConfiguration.chart;
  }

  set uiOption(uiOption: UIOption) {
    this.widgetConfiguration.chart = uiOption;
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Public Variables - Input & Output
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  @Input()
  public widgetOption: BoardWidgetOptions;

  @Input('widget')
  public inputWidget: PageWidget;

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Constructor
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  // 생성자
  constructor(private datasourceService: DatasourceService,
              private widgetService: WidgetService,
              private imageService: ImageService,
              protected broadCaster: EventBroadcaster,
              protected elementRef: ElementRef,
              protected injector: Injector,
              private analysisPredictionService: AnalysisPredictionService) {
    super(broadCaster, elementRef, injector);
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Override Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /**
   * 컴포넌트 초기 실행
   */
  public ngOnInit() {
    super.ngOnInit();
  }

  /**
   * Input 값 변경 체크
   * @param {SimpleChanges} changes
   */
  public ngOnChanges(changes: SimpleChanges) {
    const inputWidgetChanges: SimpleChange = changes.inputWidget;
    if (inputWidgetChanges && inputWidgetChanges.currentValue) {
      this._setWidget(inputWidgetChanges.currentValue);
    }
  } // function - ngOnChanges

  public ngAfterViewInit() {
    super.ngAfterViewInit();

    // 사용자 정의 컬럼 사용 여부 확인
    const conf: PageWidgetConfiguration = this.widget.configuration as PageWidgetConfiguration;
    let useCustomField: boolean = false;
    if (useCustomField || conf.pivot.aggregations.some(field => field.ref && 'user_defined' === field.ref)) {
      useCustomField = true;
    }
    if (useCustomField || conf.pivot.rows.some(field => field.ref && 'user_defined' === field.ref)) {
      useCustomField = true;
    }
    if (useCustomField || conf.pivot.columns.some(field => field.ref && 'user_defined' === field.ref)) {
      useCustomField = true;
    }
    this.useCustomField = useCustomField;

    // 새로 고침 이벤트
    this.subscriptions.push(
      this.broadCaster.on<any>('REFRESH_WIDGET').subscribe(data => {
        (this.widget.id === data.widgetId) && (this._search());
      })
    );

    // 타이틀 변경 이벤트
    this.subscriptions.push(
      this.broadCaster.on<any>('WIDGET_CHANGE_TITLE').subscribe(data => {
        if (this.isShowHierarchyView && this.parentWidget) {
          if (this.parentWidget.id === data.widgetId) {
            this.parentWidget.name = data.value;
          } else if (this.widget.id === data.widgetId) {
            this.widget.name = data.value;
          }
          this.safelyDetectChanges();
        }
      })
    );

    // 범례 표시 변경
    this.subscriptions.push(
      this.broadCaster.on<any>('TOGGLE_LEGEND').subscribe(data => {
        if (data.widgetId === this.widget.id) {
          this.toggleLegend();
        }
      })
    );

    // 미니맵 표시 변경
    this.subscriptions.push(
      this.broadCaster.on<any>('TOGGLE_MINIMAP').subscribe(data => {
        if (data.widgetId === this.widget.id) {
          this.toggleMiniMap();
        }
      })
    );

    // 모드 변경
    this.subscriptions.push(
      this.broadCaster.on<any>('CHANGE_MODE').subscribe(data => {
        if (data.widgetId === this.widget.id) {
          this.changeMode(data.mode);
        }
      })
    );

    // 외부 필터 설정
    this.subscriptions.push(
      this.broadCaster.on<any>('SET_EXTERNAL_FILTER').subscribe(data => {
        if (data.widgetId && data.widgetId === this.widget.id) {
          this._search(data.filters);
        } else if (data.excludeWidgetId !== this.widget.id) {
          this._search(data.filters);
        }
      })
    );

    // 사용자 필드 갱신
    this.subscriptions.push(
      this.broadCaster.on<any>('SET_CUSTOM_FIELDS').subscribe(data => {
        this.widget.configuration['customFields'] = data.customFields;
      })
    );

    // 위젯 설정 변경 및 새로고침
    this.subscriptions.push(
      this.broadCaster.on<any>('SET_WIDGET_CONFIG').subscribe(data => {
        if (data.widgetId === this.widget.id) {
          this.widget.configuration = data.config;
          (data.refresh) && (this._search());
        }
      })
    );

    // 위젯 설정 변경 및 새로고침
    this.subscriptions.push(
      this.broadCaster.on<any>('RESIZE_WIDGET').subscribe(data => {
        if (data && data.widgetId) {
          if (data.widgetId === this.widget.id) {
            this.resize();
          }
        } else {
          this.resize();
        }
      })
    );

  } // function - ngAfterViewInit

  // Destroy
  public ngOnDestroy() {
    super.ngOnDestroy();
    clearInterval(this._interval);
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Public Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /**
   * 범례 표시여부 변경
   * @param {boolean} mode : 표시 여부
   */
  public toggleLegend(mode?: boolean): void {
    if (this.uiOption && this.chartFuncValidator.checkUseLegendByTypeString(this.chartType)) {
      const legend = _.cloneDeep(this.uiOption.legend);
      if (legend) {
        legend.auto = ('boolean' === typeof mode) ? mode : !legend.auto;
        legend.convertType = LegendConvertType.SHOW;
        this.uiOption = <UIOption>_.extend({}, this.uiOption, { legend });
        // 변경 적용
        this.safelyDetectChanges();
      }
    }
  } // function - toggleLegend

  /**
   * 미니맵 표시여부 변경
   * @param {boolean} mode : 표시 여부
   */
  public toggleMiniMap(mode?: boolean): void {
    if (this.uiOption && this.chartFuncValidator.checkUseMiniMapByTypeString(this.chartType)) {
      const chartZooms = _.cloneDeep(this.uiOption.chartZooms);
      if (chartZooms) {
        chartZooms.map((zoom) => (zoom.auto = ('boolean' === typeof mode) ? mode : !zoom.auto));
        this.uiOption = <UIOption>_.extend({}, this.uiOption, { chartZooms });
        // 변경 적용
        this.safelyDetectChanges();
      }
    }
  } // function - toggleMiniMap

  /**
   * 모드 변경
   * @param {string} mode
   */
  public changeMode(mode: string) {
    if (this.widget.mode !== mode) {
      this.widget.mode = mode;
      this.safelyDetectChanges();
      // pivot grid 호출
      ('grid' === mode) && (this._initGridChart());
      this.resize(true);
    }
  } // function - changeMode

  /**
   * 사이즈 재조정
   * @param {boolean} isImmediate
   */
  public resize(isImmediate: boolean = false) {
    if (this.chart) {
      // 변경 적용
      this.safelyDetectChanges();
      setTimeout(
        () => {
          // control
          if (this.chart.hasOwnProperty('barChart') && this.chart.hasOwnProperty('lineChart')) {
            const barChart: BarChartComponent = this.chart['barChart'];
            const lineChart: LineChartComponent = this.chart['lineChart'];
            barChart.chart.resize();
            lineChart.chart.resize();
          } else if (this.chart.uiOption.type === ChartType.LABEL || this.chart.uiOption.type === ChartType.MAPVIEW) {

          } else if (this.widgetConfiguration.chart.type.toString() === 'grid') {
            //(<GridChartComponent>this.chart).grid.arrange();
          } else if (this.chart.uiOption.type === ChartType.NETWORK) {
            (<NetworkChartComponent>this.chart).draw();
          } else {
            if (this.chart && this.chart.chart) this.chart.chart.resize();
          }
          // 변경 적용
          this.safelyDetectChanges();
        },
        isImmediate ? 0 : 300
      );

    }

    if (this.gridChart) {
      setTimeout(() => this.gridChart.chart.arrange(), isImmediate ? 0 : 300);
    }
  } // function - resize

  // noinspection JSMethodCanBeStatic
  /**
   * 그리드 유효 여부
   * @param {PageWidget} widget
   * @returns {boolean}
   */
  public isAvaliableGrid(widget: PageWidget) {
    const chartType = (<PageWidgetConfiguration>widget.configuration).chart.type.toString();
    const notAvaliableChart = ['grid', 'scatter', 'pie'];

    return (notAvaliableChart.indexOf(chartType) === -1);
  } // function - isAvaliableGrid

  /**
   * 차트 선택, 비선택
   * @param {ChartSelectInfo} data
   */
  public chartSelectInfo(data: ChartSelectInfo) {
    if (this.layoutMode === LayoutMode.EDIT) {
      Alert.info(this.translateService.instant('msg.board.alert.not-select-editmode'));
    } else {

      // 임시적으로 에러 방지를 위해 params 가 정의되어 있지 않을 때, 강제적으로 widgetId를 설정해줌
      if (!data.params) {
        data.params = {
          widgetId: this.widget.id,
          externalFilters: false
        };
      }
      const widgetDataSource: Datasource
        = DashboardUtil.getDataSourceFromBoardDataSource(this.widget.dashBoard, this.widgetConfiguration.dataSource);
      (widgetDataSource) && (data.params.dataSourceId = widgetDataSource.id);

      this.broadCaster.broadcast('CHART_SELECTION_FILTER', { select: data });
    }
  } // function - chartSelectInfo

  /**
   * 차트 옵션 변경 적용
   * @param uiOption
   */
  public uiOptionUpdatedHandler(uiOption) {
    this.uiOption = _.extend({}, this.uiOption, uiOption);
    if (this.widgetOption) {
      if (WidgetShowType.BY_WIDGET !== this.widgetOption.showMinimap) {
        this.toggleMiniMap((WidgetShowType.ON === this.widgetOption.showMinimap));
      }
      if (WidgetShowType.BY_WIDGET !== this.widgetOption.showLegend) {
        this.toggleLegend((WidgetShowType.ON === this.widgetOption.showLegend));
      }
    }
  } // function - uiOptionUpdatedHandler

  /**
   * 그리드 차트 옵션 변경 적용
   * @param uiOption
   */
  public gridUiOptionUpdatedHandler(uiOption) {
    this.gridUiOption = _.extend({}, this.gridUiOption, uiOption);
  } // function - updateGridUIOption

  /**
   * 차트 표시 완료 이벤트
   */
  public updateComplete() {
    if (this._isDuringProcess) {

      // 새로고침 다시 그림 여부 설정
      this.isUpdateRedraw = (LayoutMode.EDIT === this.layoutMode);

      this.processEnd();
      this._isDuringProcess = false;
    }
  } // function - updateComplete

  /**
   * 데이터 없음 표시
   */
  public showNoData() {
    this.isShowNoData = true;
    this.updateComplete();
  } // function - showNoData

  /**
   * 에러 표시
   */
  public showError() {
    this.isError = true;
    this.updateComplete();
  } // function - showError

  /**
   * 위젯 이름 표시 여부
   * @return {boolean}
   */
  public isShowWidgetName(): boolean {
    return this.isViewMode && this.widget && this.widget.name && this.isShowTitle && !this.isShowHierarchyView;
  } // function - isShowWidgetName

  /**
   * 차트의 아이콘 클래스명 반환
   * @return {string}
   */
  public getChartIconClass(): string {
    let iconClass: string = '';
    switch (this.widget.configuration.chart.type) {
      case ChartType.BAR :
        iconClass = 'ddp-chart-bar';
        break;
      case ChartType.LINE :
        iconClass = 'ddp-chart-linegraph';
        break;
      case ChartType.GRID :
        iconClass = 'ddp-chart-table';
        break;
      case ChartType.SCATTER :
        iconClass = 'ddp-chart-scatter';
        break;
      case ChartType.HEATMAP :
        iconClass = 'ddp-chart-heatmap';
        break;
      case ChartType.PIE :
        iconClass = 'ddp-chart-pie';
        break;
      case ChartType.MAPVIEW :
        iconClass = 'ddp-chart-map';
        break;
      case ChartType.CONTROL :
        iconClass = 'ddp-chart-cont';
        break;
      case ChartType.LABEL :
        iconClass = 'ddp-chart-kpi';
        break;
      case ChartType.LABEL2 :
        iconClass = 'ddp-chart-kpi';
        break;
      case ChartType.BOXPLOT :
        iconClass = 'ddp-chart-boxplot';
        break;
      case ChartType.WATERFALL :
        iconClass = 'ddp-chart-waterfall';
        break;
      case ChartType.WORDCLOUD :
        iconClass = 'ddp-chart-wordcloud';
        break;
      case ChartType.COMBINE :
        iconClass = 'ddp-chart-combo';
        break;
      case ChartType.TREEMAP :
        iconClass = 'ddp-chart-treemap';
        break;
      case ChartType.RADAR :
        iconClass = 'ddp-chart-radar';
        break;
      case ChartType.NETWORK :
        iconClass = 'ddp-chart-network';
        break;
      case ChartType.SANKEY :
        iconClass = 'ddp-chart-sankey';
        break;
      case ChartType.GAUGE :
        iconClass = 'ddp-chart-bar';
        break;
    }
    return iconClass;
  } // function - getChartIconClass
  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Public Method - for Header
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  /**
   * 데이터소스 이름 조회
   * @return {string}
   */
  public getDataSourceName(): string {
    let strName: string = '';
    if (this.widget && this.widget.configuration.dataSource) {
      strName = DashboardUtil.getDataSourceFromBoardDataSource(
        this.widget.dashBoard, this.widget.configuration.dataSource
      ).name;
    }
    return strName;
  } // function - getDataSourceName

  /**
   * 대시보드 아이디 클립보드에 복사
   */
  public copyWidgetIdToClipboard() {
    if (this.widget) {
      const option = { text: () => this.widget.id };
      new Clipboard(this.elementRef.nativeElement, option);
    }
  } // function - copyWidgetIdToClipboard

  /**
   * 피봇 정보 존재 여부
   * @param {string} category
   * @return {boolean}
   */
  public existPivot(category: string): boolean {
    return (this.widget && this.widget.configuration['pivot']
      && this.widget.configuration['pivot'][category]
      && 0 < this.widget.configuration['pivot'][category].length);
  } // function - existPivot

  /**
   * 선반의 필드 목록 반환
   * @param {string} category
   * @return {string}
   */
  public getPivotFieldsStr(category: string): string {
    let strFields: string = '';
    if (this.widget && this.widget.configuration['pivot']) {
      const pivotData = this.widget.configuration['pivot'][category];
      if (pivotData) {
        strFields = pivotData.map(item => item.name).join(',');
      }
    }
    return strFields;
  } // function - getPivotFieldsStr

  /**
   * 차트 필터 존재 여부
   * @return {boolean}
   */
  public existChartFilter(): boolean {
    return (this.widget && this.widget.configuration.filters && 0 < this.widget.configuration.filters.length);
  } // function - existChartFilter

  /**
   * 차트 필터 필드 목록 반환
   * @return {string}
   */
  public getChartFilterStr(): string {
    let strFields: string = '';
    if (this.widget && this.widget.configuration.filters) {
      strFields = this.widget.configuration.filters.map(item => item.field).join(',');
    }
    return strFields;
  } // function - getChartFilterStr

  /**
   * 차트 타입이 그리드 인지 반환한다.
   * @returns {boolean}
   */
  public isGridType(): boolean {
    if (this.widget) {
      const chartConf = this.widget.configuration.chart;
      return (chartConf && ChartType.GRID === chartConf.type) || ('grid' === this.widget.mode);
    } else {
      return false;
    }
  } // function - isGridType

  /**
   * 위젯 사이즈 전환
   */
  public toggleWidgetSize() {
    this.isMaximize = !this.isMaximize;
    this.broadCaster.broadcast('TOGGLE_SIZE', { widgetId: this.widget.id });
  } // function - toggleWidgetSize

  /**
   * 다운로드 팝업 표시
   * @param {MouseEvent} event
   */
  public showDownPivotData(event: MouseEvent) {
    if (!this.useCustomField) {
      this.isShowDownloadPopup = true;
      this._dataDownComp.openWidgetDown(event, this.widget.id);
    }
  } // function - showDownPivotData

  /**
   * 차트 이미지를 다운로드 한다.
   */
  public downloadChartImage() {
    // this.duringImageDown = true;
    // const tempWidget: PageWidget = <PageWidget>this.widget;

    this.imageService.downloadElementImage(this.$element.find('.ddp-box-widget:visible'), 'ChartImage.jpg');

    /*
    if (tempWidget.imageUrl) {
      this.imageService.downloadImageFromUrl(tempWidget.imageUrl)
        .then((result) => {
          saveAs(result.blob(), 'ChartImage.jpg');
          this.duringImageDown = false;
        })
        .catch(() => { this.duringImageDown = true; });
    } else {
      console.info('downerror');
      console.info(tempWidget);
    }
    */
  } // function - downloadChartImage

  /**
   * 마우스 select 모드 변경 변경
   * @param {string} mode
   * @param {string} brushType
   */
  public changeMouseSelectMode(mode: string, brushType: string) {
    if (ChartMouseMode.SINGLE.toString() === mode) {
      this.mouseMode = 'SINGLE';
      this.chart.convertMouseMode(ChartMouseMode.SINGLE);
    } else if (ChartMouseMode.MULTI.toString() === mode) {
      if (BrushType.RECT.toString() === brushType) {
        this.mouseMode = 'MULTI_RECT';
        this.chart.convertMouseMode(ChartMouseMode.MULTI, BrushType.RECT);
      } else {
        this.mouseMode = 'MULTI_POLY';
        this.chart.convertMouseMode(ChartMouseMode.MULTI, BrushType.POLYGON);
      }
    }
  } // function - changeMouseSelectMode

  /**
   * 마우스 zoomMode 모드 변경 변경
   * @param {string} mode
   */
  public changeMouseZoomMode(mode: string) {
    switch (mode) {
      case ChartMouseMode.DRAGZOOMIN.toString() :
        this.chart.convertMouseMode(ChartMouseMode.DRAGZOOMIN);
        break;
      case ChartMouseMode.ZOOMIN.toString() :
        this.chart.convertMouseMode(ChartMouseMode.ZOOMIN);
        break;
      case ChartMouseMode.ZOOMOUT.toString() :
        this.chart.convertMouseMode(ChartMouseMode.ZOOMOUT);
        break;
      case ChartMouseMode.REVERT.toString() :
        this.chart.convertMouseMode(ChartMouseMode.REVERT);
        break;
    }
  } // function - changeMouseZoomMode

  /**
   * 스타일 강제 설정
   * @param {boolean} isDisplay
   */
  public setForceStyle(isDisplay: boolean) {
    const $container: JQuery = $('.ddp-ui-widget');
    const $contents: JQuery = $('.ddp-ui-dash-contents');
    if (isDisplay) {
      this._dashboardOverflow = $container.css('overflow');
      // console.info( $( '.ddp-ui-widget').css( 'overflow' ) );
      $contents.css('z-index', 3);
      $container.css('overflow', '');
    } else {
      $contents.css('z-index', '');
      // $( '.ddp-ui-widget').css( 'overflow', this._dashboardOverflow );
    }
  } // function - setForceStyle

  /**
   * 차트 정보 레이어 표시될때의 처리 - 레이어 위치 설정
   * @param {MouseEvent} event
   */
  public showInfoLayer(event: MouseEvent) {
    let $target: JQuery = $(event.target);
    const btnLeft: number = $target.offset().left;
    const btnTop: number = $target.offset().top;
    this.$element.find('.ddp-box-layout4').css({ 'left': btnLeft - 150, 'top': btnTop + 25 });
  } // function - showInfoLayer

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Private Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  /**
   * 위젯 설정
   * @param {PageWidget} widget
   * @private
   */
  private _setWidget(widget: PageWidget) {
    this.widget = <PageWidget>_.extend(new PageWidget(), widget);
    this.widgetConfiguration = <PageWidgetConfiguration>this.widget.configuration;
    this.chartType = this.widgetConfiguration.chart.type.toString();
    this.parentWidget = null;
    if (widget.dashBoard.configuration) {
      const boardConf: BoardConfiguration = widget.dashBoard.configuration;

      // Pivot 내 누락된 필드 정보 설정
      const widgetDataSource: Datasource
        = DashboardUtil.getDataSourceFromBoardDataSource(this.widget.dashBoard, this.widgetConfiguration.dataSource);
      const fields: Field[] = DashboardUtil.getFieldsForMainDataSource(this.widget.dashBoard.configuration, widgetDataSource.id);
      fields.forEach((field) => {
        this.widgetConfiguration.pivot.rows
          .forEach((abstractField) => {
            if (isNullOrUndefined(abstractField.field)
              && String(field.biType) == abstractField.type.toUpperCase() && field.name == abstractField.name) {
              abstractField.field = field;
            }
          });

        this.widgetConfiguration.pivot.columns
          .forEach((abstractField) => {
            if (isNullOrUndefined(abstractField.field)
              && String(field.biType) == abstractField.type.toUpperCase() && field.name == abstractField.name) {
              abstractField.field = field;
            }
          });

        this.widgetConfiguration.pivot.aggregations
          .forEach((abstractField) => {
            if (isNullOrUndefined(abstractField.field)
              && String(field.biType) == abstractField.type.toUpperCase() && field.name == abstractField.name) {
              abstractField.field = field;
            }
          });
      });

      // Hierarchy 설정
      if (boardConf.relations) {
        const relations: DashboardPageRelation[] = boardConf.relations;
        const parentWidgetId: string = this._findParentWidgetId(this.widget.id, relations);
        if (parentWidgetId) {
          this.parentWidget = widget.dashBoard.widgets.find(item => item.id === parentWidgetId);
          this.isShowHierarchyView = true;
        }
      }
      // RealTime 데이터갱신 설정
      if (this.layoutMode !== LayoutMode.EDIT && boardConf.options.sync && boardConf.options.sync.enabled) {
        const syncOpts: BoardSyncOptions = boardConf.options.sync;
        this._interval = setInterval(() => {
          this.safelyDetectChanges();
          (this.parentWidget) || (this._search());
        }, syncOpts.interval * 1000);
      }

      this.safelyDetectChanges();

      (this.parentWidget) || (this._search());
    } // end if - dashboard.configuration

    this.safelyDetectChanges();
    this.isInvalidPivot = !this.chart.isValid(this.widgetConfiguration.pivot);

  } // function - _setWidget

  /**
   * 데이터 검색
   * @param {Filter[]} externalFilters
   * @private
   */
  private _search(externalFilters?: Filter[]) {

    if (!this.chart) {
      return;
    }

    // 버전 확인
    if (!this.uiOption.version || this.uiOption.version < SPEC_VERSION) {
      // 옵션 초기화
      this.uiOption = OptionGenerator.initUiOption(this.uiOption);
    }

    // Hierarchy View 설정
    if (this.parentWidget) {
      if (externalFilters) {
        const idx = externalFilters.findIndex(item => this.parentWidget.id === item['selectedWidgetId']);
        if (-1 < idx) {
          this.isShowHierarchyView = false;
        } else {
          this.isShowHierarchyView = true;
          this.safelyDetectChanges();
          return;
        }
      } else {
        this.isShowHierarchyView = true;
        this.safelyDetectChanges();
        return;
      }
    }

    const boardConf: BoardConfiguration = this.widget.dashBoard.configuration;

    // 커스텀 필드 설정
    const boardCustomFields: CustomField[] = boardConf.customFields;
    if (boardCustomFields && 0 < boardCustomFields.length) {
      const chartCustomField: CustomField[] = this.widgetConfiguration.customFields;
      if (!chartCustomField || chartCustomField.length !== boardCustomFields.length) {
        this.widgetConfiguration.customFields = $.extend(chartCustomField, _.cloneDeep(boardCustomFields));
      }
    }

    // 쿼리 생성
    const query: SearchQueryRequest
      = this.datasourceService.makeQuery(
      this.widgetConfiguration,
      boardConf.fields,
      {
        url: this.router.url,
        dashboardId: this.widget.dashBoard.id,
        widgetId: this.widget.id
      }, null, true
    );

    // 선반 정보가 없을 경우 반환
    if (query.pivot.columns.length + query.pivot.rows.length + query.pivot.aggregations.length === 0) {
      return;
    }

    const uiCloneQuery = _.cloneDeep(query);

    // 필터 설정
    const widgetDataSource: Datasource = DashboardUtil.getDataSourceFromBoardDataSource(this.widget.dashBoard, this.widgetConfiguration.dataSource);
    if (isNullOrUndefined(externalFilters)) {
      // 외부필터가 없고 글로벌 필터가 있을 경우 추가 (초기 진입시)
      // const boardFilter: Filter[] = DashboardUtil.getFiltersForBoardDataSource( this.widget.dashBoard, widgetDataSource.id );
      // const relBoardFilters:Filter[] = DashboardUtil.getRelationDsFilters( this.widget.dashBoard, widgetDataSource.engineName );
      // (relBoardFilters && 0 < relBoardFilters.length) && ( uiCloneQuery.filters = relBoardFilters.concat(uiCloneQuery.filters) );
      const boardFilter: Filter[] = DashboardUtil.getAllFiltersDsRelations(this.widget.dashBoard, widgetDataSource.id);
      (boardFilter && 0 < boardFilter.length) && (uiCloneQuery.filters = boardFilter.concat(uiCloneQuery.filters));
    } else {
      // 외부 필터 ( 글로벌 필터 + Selection Filter )
      // externalFilters = externalFilters.filter( item => item.dataSource === widgetDataSource.id );
      externalFilters = DashboardUtil.getAllFiltersDsRelations(this.widget.dashBoard, widgetDataSource.id, externalFilters);

      uiCloneQuery.filters.forEach(item1 => {
        const idx: number = externalFilters.findIndex(item2 => {
          return item1.field === item2.field && item1.ref === item2.ref;
        });
        if (-1 < idx) {
          const selection = externalFilters.splice(idx, 1)[0];
          if ('include' === item1.type || FilterUtil.isTimeListFilter(item1)) {
            item1['valueList'] = item1['valueList'] ? _.uniq(item1['valueList'].concat(selection['valueList'])) : selection['valueList'];
          } else if (FilterUtil.isTimeFilter(item1)) {
            const timeFilter = <TimeFilter>item1;
            const timeSelection: TimeListFilter = FilterUtil.getTimeListFilter(
              timeFilter.clzField, timeFilter.discontinuous,
              timeFilter.timeUnit, timeFilter.byTimeUnit, timeFilter.ui.importanceType
            );
            timeSelection.valueList = selection['valueList'];
            item1 = timeSelection;
          }
        }
      });
      uiCloneQuery.filters = externalFilters.concat(uiCloneQuery.filters);
    }

    // 프로세스 실행 등록
    this.processStart();
    this._isDuringProcess = true;
    this.isShowNoData = false;
    this.isError = false;

    // 서버 조회용 파라미터 (서버 조회시 필요없는 파라미터 제거)
    const cloneQuery = this._makeSearchQueryParam(_.cloneDeep(uiCloneQuery));

    this.query = cloneQuery;
    if (this.chartType === 'label') {
      this.chart['setQuery'] = this.query;
    }

    this.datasourceService.searchQuery(cloneQuery).then((data) => {

      this.resultData = {
        data,
        config: query,
        uiOption: this.uiOption,
        params: {
          widgetId: this.widget.id,
          externalFilters: (externalFilters !== undefined)
        }

      };

      let optionKeys = Object.keys(this.uiOption);
      if (optionKeys && optionKeys.length === 1) {
        delete this.resultData.uiOption;
      }

      this._initGridChart();

      // 대시보드 편집일 경우 차트 클릭 막음( params는 차트 클릭시 돌려받는 값)
      if (this.layoutMode === LayoutMode.EDIT && this.resultData.params) {
        delete this.resultData.params;
      }

      // line차트이면서 columns 데이터가 있는경우
      if (this.chartType === 'line' && this.resultData.data.columns && this.resultData.data.columns.length > 0) {
        // 고급분석 예측선 API 호출
        this.getAnalysis();
      } else {
        this.chart.resultData = this.resultData;
      }

      // 변경 적용
      this.safelyDetectChanges();
    }).catch((error) => {
      console.error(error);
      // 프로세스 종료 등록 및 No Data 표시
      this.showError();
      // 변경 적용
      this.safelyDetectChanges();
    });
  } // function - _search

  // noinspection JSMethodCanBeStatic
  /**
   * 서버시에 필요없는 ui에서만 사용되는 파라미터 제거
   */
  private _makeSearchQueryParam(cloneQuery): SearchQueryRequest {

    // 선반 데이터 설정
    for (let field of _.concat(cloneQuery.pivot.columns, cloneQuery.pivot.rows, cloneQuery.pivot.aggregations)) {
      // delete field['field'];
      delete field['currentPivot'];
      delete field['granularity'];
      delete field['segGranularity'];
    }

    // 필터 설정
    for (let filter of cloneQuery.filters) {
      filter = FilterUtil.convertToServerSpec(filter);
    }

    // 값이 없는 측정값 필터 제거
    cloneQuery.filters = cloneQuery.filters.filter(item => {
      return (item.type === 'include' && item['valueList'] && 0 < item['valueList'].length) ||
        (item.type === 'bound' && item['min'] != null) ||
        FilterUtil.isTimeAllFilter(item) ||
        FilterUtil.isTimeRelativeFilter(item) ||
        FilterUtil.isTimeRangeFilter(item) ||
        (FilterUtil.isTimeListFilter(item) && item['valueList'] && 0 < item['valueList'].length);
    });

    return cloneQuery;
  } // function - _makeSearchQueryParam

  /**
   * 그리드 데이터 호출
   * @private
   */
  private _initGridChart() {
    try {
      if (this.gridChart && this.gridChart.isLoaded) {
        this.gridChart.resultData = this.resultData;
      }
    } catch (err) {
      console.error(err);
    }
  } // function - _initGridChart

  /**
   * 부모 위젯 아이디 탐색
   * @param {string} widgetId
   * @param {DashboardPageRelation[]} relations
   * @returns {string}
   * @private
   */
  private _findParentWidgetId(widgetId: string, relations: DashboardPageRelation[]): string {
    let parentId: string = '';

    relations.some(item => {
      if (item.children) {
        if (-1 < item.children.findIndex(child => child.ref === widgetId)) {
          parentId = item.ref;
          return true;
        } else {
          parentId = this._findParentWidgetId(widgetId, item.children);
          return ('' !== parentId);
        }
      } else {
        return false;
      }
    });

    return parentId;
  } // function - _findParentWidgetId

  // ----------------------------------------------------
  // 고급분석 예측선 관련
  // ----------------------------------------------------

  /**
   * 고급분석 예측선 활성화 여부 검사
   * @returns {boolean}
   */
  private isAnalysisPredictionEnabled(): boolean {
    return !_.isUndefined(this.widgetConfiguration.analysis) && !_.isEmpty(this.widgetConfiguration.analysis);
  }

  /**
   * 고급분석 예측선을 사용안하는 경우 처리
   */
  private predictionLineDisabled(): void {
    this.chart.analysis = null;
    this.chart.resultData = this.resultData;
  }

  /**
   * 고급분석 예측선 API 호출
   */
  private getAnalysis(): void {
    if (this.isAnalysisPredictionEnabled()) {
      Promise
        .resolve()
        .then(() => {
          if (this.isAnalysisPredictionEnabled()) {
            this.analysisPredictionService.getAnalysisPredictionLineFromDashBoard(this.widgetConfiguration, this.widget, this.chart, this.resultData);
          } else {
            this.predictionLineDisabled();
          }
        });
    } else {
      this.predictionLineDisabled();
    }
  }

}
