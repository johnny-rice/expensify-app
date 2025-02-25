import isEmpty from 'lodash/isEmpty';
import React, {useContext, useMemo} from 'react';
import type {TextStyle} from 'react-native';
import {StyleSheet} from 'react-native';
import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';
import {useOnyx} from 'react-native-onyx';
import type {CustomRendererProps, TPhrasing, TText} from 'react-native-render-html';
import {ShowContextMenuContext} from '@components/ShowContextMenuContext';
import Text from '@components/Text';
import useCurrentReportID from '@hooks/useCurrentReportID';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeStyles from '@hooks/useThemeStyles';
import getTopmostCentralPaneRoute from '@libs/Navigation/getTopmostCentralPaneRoute';
import type {RootStackParamList, State} from '@libs/Navigation/types';
import Navigation, {navigationRef} from '@navigation/Navigation';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Route} from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import type {Report} from '@src/types/onyx';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import MentionReportContext from './MentionReportContext';

type MentionReportRendererProps = CustomRendererProps<TText | TPhrasing>;

const removeLeadingLTRAndHash = (value: string) => value.replace(CONST.UNICODE.LTR, '').replace('#', '');

const getMentionDetails = (htmlAttributeReportID: string, currentReport: OnyxEntry<Report>, reports: OnyxCollection<Report>, tnode: TText | TPhrasing) => {
    let reportID: string | undefined;
    let mentionDisplayText: string;

    // Get mention details based on reportID from tag attribute
    if (!isEmpty(htmlAttributeReportID)) {
        const report = reports?.[`${ONYXKEYS.COLLECTION.REPORT}${htmlAttributeReportID}`];
        reportID = report?.reportID ?? htmlAttributeReportID;
        mentionDisplayText = removeLeadingLTRAndHash(report?.reportName ?? htmlAttributeReportID);
        // Get mention details from name inside tnode
    } else if ('data' in tnode && !isEmptyObject(tnode.data)) {
        mentionDisplayText = removeLeadingLTRAndHash(tnode.data);

        // eslint-disable-next-line rulesdir/prefer-early-return
        Object.values(reports ?? {}).forEach((report) => {
            if (report?.policyID === currentReport?.policyID && removeLeadingLTRAndHash(report?.reportName ?? '') === mentionDisplayText) {
                reportID = report?.reportID;
            }
        });
    } else {
        return null;
    }

    return {reportID, mentionDisplayText};
};

function MentionReportRenderer({style, tnode, TDefaultRenderer, ...defaultRendererProps}: MentionReportRendererProps) {
    const styles = useThemeStyles();
    const StyleUtils = useStyleUtils();
    const htmlAttributeReportID = tnode.attributes.reportid;
    const {currentReportID: currentReportIDContext, exactlyMatch} = useContext(MentionReportContext);
    const [reports] = useOnyx(ONYXKEYS.COLLECTION.REPORT);

    const currentReportID = useCurrentReportID();
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const currentReportIDValue = currentReportIDContext || currentReportID?.currentReportID;
    const [currentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${currentReportIDValue}`);

    // When we invite someone to a room they don't have the policy object, but we still want them to be able to see and click on report mentions, so we only check if the policyID in the report is from a workspace
    const isGroupPolicyReport = useMemo(() => currentReport && !isEmptyObject(currentReport) && !!currentReport.policyID && currentReport.policyID !== CONST.POLICY.ID_FAKE, [currentReport]);

    const mentionDetails = getMentionDetails(htmlAttributeReportID, currentReport, reports, tnode);
    if (!mentionDetails) {
        return null;
    }
    const {reportID, mentionDisplayText} = mentionDetails;

    let navigationRoute: Route | undefined = reportID ? ROUTES.REPORT_WITH_ID.getRoute(reportID) : undefined;
    const topmostCentralPaneRoute = getTopmostCentralPaneRoute(navigationRef.getRootState() as State<RootStackParamList>);
    const backTo = Navigation.getActiveRoute();
    if (topmostCentralPaneRoute?.name === SCREENS.SEARCH.CENTRAL_PANE) {
        navigationRoute = reportID ? ROUTES.SEARCH_REPORT.getRoute({reportID, backTo}) : undefined;
    }
    const isCurrentRoomMention = reportID === currentReportIDValue;

    const flattenStyle = StyleSheet.flatten(style as TextStyle);
    const {color, ...styleWithoutColor} = flattenStyle;

    return (
        <ShowContextMenuContext.Consumer>
            {() => (
                <Text
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    {...defaultRendererProps}
                    style={
                        isGroupPolicyReport && (!exactlyMatch || navigationRoute)
                            ? [styles.link, styleWithoutColor, StyleUtils.getMentionStyle(isCurrentRoomMention), {color: StyleUtils.getMentionTextColor(isCurrentRoomMention)}]
                            : []
                    }
                    suppressHighlighting
                    onPress={
                        navigationRoute && isGroupPolicyReport
                            ? (event) => {
                                  event.preventDefault();
                                  Navigation.navigate(navigationRoute);
                              }
                            : undefined
                    }
                    role={isGroupPolicyReport ? CONST.ROLE.LINK : undefined}
                    accessibilityLabel={isGroupPolicyReport ? `/${navigationRoute}` : undefined}
                >
                    #{mentionDisplayText}
                </Text>
            )}
        </ShowContextMenuContext.Consumer>
    );
}

MentionReportRenderer.displayName = 'MentionReportRenderer';

export default MentionReportRenderer;
