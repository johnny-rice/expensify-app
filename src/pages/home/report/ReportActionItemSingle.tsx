import React, {useCallback, useMemo} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';
import Avatar from '@components/Avatar';
import {FallbackAvatar} from '@components/Icon/Expensicons';
import MultipleAvatars from '@components/MultipleAvatars';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import PressableWithoutFeedback from '@components/Pressable/PressableWithoutFeedback';
import SubscriptAvatar from '@components/SubscriptAvatar';
import Text from '@components/Text';
import Tooltip from '@components/Tooltip';
import UserDetailsTooltip from '@components/UserDetailsTooltip';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import usePolicy from '@hooks/usePolicy';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import ControlSelection from '@libs/ControlSelection';
import DateUtils from '@libs/DateUtils';
import Navigation from '@libs/Navigation/Navigation';
import {getPersonalDetailByEmail} from '@libs/PersonalDetailsUtils';
import {getReportActionMessage} from '@libs/ReportActionsUtils';
import {
    getDefaultWorkspaceAvatar,
    getDisplayNameForParticipant,
    getIcons,
    getPolicyName,
    getReportActionActorAccountID,
    getWorkspaceIcon,
    isIndividualInvoiceRoom,
    isInvoiceReport as isInvoiceReportUtils,
    isInvoiceRoom,
    isOptimisticPersonalDetail,
    isPolicyExpenseChat,
    isTripRoom as isTripRoomReportUtils,
} from '@libs/ReportUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Policy, Report, ReportAction} from '@src/types/onyx';
import type {Icon} from '@src/types/onyx/OnyxCommon';
import type ChildrenProps from '@src/types/utils/ChildrenProps';
import ReportActionItemDate from './ReportActionItemDate';
import ReportActionItemFragment from './ReportActionItemFragment';

type ReportActionItemSingleProps = Partial<ChildrenProps> & {
    /** All the data of the action */
    action: OnyxEntry<ReportAction>;

    /** Styles for the outermost View */
    wrapperStyle?: StyleProp<ViewStyle>;

    /** Report for this action */
    report: OnyxEntry<Report>;

    /** IOU Report for this action, if any */
    iouReport?: OnyxEntry<Report>;

    /** Show header for action */
    showHeader?: boolean;

    /** Determines if the avatar is displayed as a subscript (positioned lower than normal) */
    shouldShowSubscriptAvatar?: boolean;

    /** If the message has been flagged for moderation */
    hasBeenFlagged?: boolean;

    /** If the action is being hovered */
    isHovered?: boolean;

    /** If the action is active */
    isActive?: boolean;

    /** Policies */
    policies?: OnyxCollection<Policy>;
};

const showUserDetails = (accountID: number | undefined) => {
    Navigation.navigate(ROUTES.PROFILE.getRoute(accountID, Navigation.getActiveRoute()));
};

const showWorkspaceDetails = (reportID: string | undefined) => {
    if (!reportID) {
        return;
    }
    Navigation.navigate(ROUTES.REPORT_WITH_ID_DETAILS.getRoute(reportID, Navigation.getReportRHPActiveRoute()));
};

function ReportActionItemSingle({
    action,
    children,
    wrapperStyle,
    showHeader = true,
    shouldShowSubscriptAvatar = false,
    hasBeenFlagged = false,
    report,
    iouReport,
    isHovered = false,
    isActive = false,
    policies,
}: ReportActionItemSingleProps) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const StyleUtils = useStyleUtils();
    const {translate} = useLocalize();
    const [personalDetails] = useOnyx(ONYXKEYS.PERSONAL_DETAILS_LIST, {
        canBeMissing: true,
    });
    const [innerPolicies] = useOnyx(ONYXKEYS.COLLECTION.POLICY, {
        canBeMissing: true,
    });
    const activePolicies = policies ?? innerPolicies;
    const policy = usePolicy(report?.policyID);
    const delegatePersonalDetails = action?.delegateAccountID ? personalDetails?.[action?.delegateAccountID] : undefined;
    const ownerAccountID = iouReport?.ownerAccountID ?? action?.childOwnerAccountID;
    const isReportPreviewAction = action?.actionName === CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW;
    const actorAccountID = getReportActionActorAccountID(action, iouReport, report, delegatePersonalDetails);
    const invoiceReceiverPolicy =
        report?.invoiceReceiver && 'policyID' in report.invoiceReceiver ? activePolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report.invoiceReceiver.policyID}`] : undefined;

    let displayName = getDisplayNameForParticipant({accountID: actorAccountID, personalDetailsData: personalDetails});
    const {avatar, login, pendingFields, status, fallbackIcon} = personalDetails?.[actorAccountID ?? CONST.DEFAULT_NUMBER_ID] ?? {};
    const accountOwnerDetails = getPersonalDetailByEmail(login ?? '');

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    let actorHint = (login || (displayName ?? '')).replace(CONST.REGEX.MERGED_ACCOUNT_PREFIX, '');
    const isTripRoom = isTripRoomReportUtils(report);
    const displayAllActors = isReportPreviewAction && !isTripRoom && !isPolicyExpenseChat(report);
    const isInvoiceReport = isInvoiceReportUtils(iouReport ?? null);
    const isWorkspaceActor = isInvoiceReport || (isPolicyExpenseChat(report) && (!actorAccountID || displayAllActors));

    let avatarSource = avatar;
    let avatarId: number | string | undefined = actorAccountID;
    if (isWorkspaceActor) {
        displayName = getPolicyName({report, policy});
        actorHint = displayName;
        avatarSource = getWorkspaceIcon(report, policy).source;
        avatarId = report?.policyID;
    } else if (delegatePersonalDetails) {
        displayName = delegatePersonalDetails?.displayName ?? '';
        avatarSource = delegatePersonalDetails?.avatar;
        avatarId = delegatePersonalDetails?.accountID;
    } else if (isReportPreviewAction && isTripRoom) {
        displayName = report?.reportName ?? '';
        avatarSource = personalDetails?.[ownerAccountID ?? CONST.DEFAULT_NUMBER_ID]?.avatar;
        avatarId = ownerAccountID;
    }

    // If this is a report preview, display names and avatars of both people involved
    let secondaryAvatar: Icon;
    const primaryDisplayName = displayName;
    if (displayAllActors) {
        if (isInvoiceRoom(report) && !isIndividualInvoiceRoom(report)) {
            const secondaryPolicyAvatar = invoiceReceiverPolicy?.avatarURL ?? getDefaultWorkspaceAvatar(invoiceReceiverPolicy?.name);

            secondaryAvatar = {
                source: secondaryPolicyAvatar,
                type: CONST.ICON_TYPE_WORKSPACE,
                name: invoiceReceiverPolicy?.name,
                id: invoiceReceiverPolicy?.id,
            };
        } else {
            // The ownerAccountID and actorAccountID can be the same if a user submits an expense back from the IOU's original creator, in that case we need to use managerID to avoid displaying the same user twice
            const secondaryAccountId = ownerAccountID === actorAccountID || isInvoiceReport ? actorAccountID : ownerAccountID;
            const secondaryUserAvatar = personalDetails?.[secondaryAccountId ?? -1]?.avatar ?? FallbackAvatar;
            const secondaryDisplayName = getDisplayNameForParticipant({accountID: secondaryAccountId});

            secondaryAvatar = {
                source: secondaryUserAvatar,
                type: CONST.ICON_TYPE_AVATAR,
                name: secondaryDisplayName ?? '',
                id: secondaryAccountId,
            };
        }
    } else if (!isWorkspaceActor) {
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        const avatarIconIndex = report?.isOwnPolicyExpenseChat || isPolicyExpenseChat(report) ? 0 : 1;
        const reportIcons = getIcons(report, personalDetails, undefined, undefined, undefined, policy);

        secondaryAvatar = reportIcons.at(avatarIconIndex) ?? {name: '', source: '', type: CONST.ICON_TYPE_AVATAR};
    } else if (isInvoiceReportUtils(iouReport)) {
        const secondaryAccountId = iouReport?.managerID ?? CONST.DEFAULT_NUMBER_ID;
        const secondaryUserAvatar = personalDetails?.[secondaryAccountId ?? -1]?.avatar ?? FallbackAvatar;
        const secondaryDisplayName = getDisplayNameForParticipant({accountID: secondaryAccountId});

        secondaryAvatar = {
            source: secondaryUserAvatar,
            type: CONST.ICON_TYPE_AVATAR,
            name: secondaryDisplayName,
            id: secondaryAccountId,
        };
    } else {
        secondaryAvatar = {name: '', source: '', type: 'avatar'};
    }
    const icon = {
        source: avatarSource ?? FallbackAvatar,
        type: isWorkspaceActor ? CONST.ICON_TYPE_WORKSPACE : CONST.ICON_TYPE_AVATAR,
        name: primaryDisplayName ?? '',
        id: avatarId,
    };

    const showMultipleUserAvatarPattern = displayAllActors && !shouldShowSubscriptAvatar;

    const headingText = showMultipleUserAvatarPattern ? `${icon.name} & ${secondaryAvatar.name}` : displayName;

    // Since the display name for a report action message is delivered with the report history as an array of fragments
    // we'll need to take the displayName from personal details and have it be in the same format for now. Eventually,
    // we should stop referring to the report history items entirely for this information.
    const personArray = headingText
        ? [
              {
                  type: 'TEXT',
                  text: headingText,
              },
          ]
        : action?.person;

    const reportID = report?.reportID;
    const iouReportID = iouReport?.reportID;

    const showActorDetails = useCallback(() => {
        if (isWorkspaceActor) {
            showWorkspaceDetails(reportID);
        } else {
            // Show participants page IOU report preview
            if (iouReportID && displayAllActors) {
                Navigation.navigate(ROUTES.REPORT_PARTICIPANTS.getRoute(iouReportID, Navigation.getReportRHPActiveRoute()));
                return;
            }
            showUserDetails(Number(icon.id));
        }
    }, [isWorkspaceActor, reportID, iouReportID, displayAllActors, icon.id]);

    const shouldDisableDetailPage = useMemo(
        () =>
            CONST.RESTRICTED_ACCOUNT_IDS.includes(actorAccountID ?? CONST.DEFAULT_NUMBER_ID) ||
            (!isWorkspaceActor && isOptimisticPersonalDetail(action?.delegateAccountID ? Number(action.delegateAccountID) : (actorAccountID ?? CONST.DEFAULT_NUMBER_ID))),
        [action, isWorkspaceActor, actorAccountID],
    );

    const getBackgroundColor = () => {
        if (isActive) {
            return theme.messageHighlightBG;
        }
        if (isHovered) {
            return theme.hoverComponentBG;
        }
        return theme.sidebar;
    };
    const getAvatar = () => {
        if (shouldShowSubscriptAvatar) {
            return (
                <SubscriptAvatar
                    mainAvatar={icon}
                    secondaryAvatar={secondaryAvatar}
                    noMargin
                    backgroundColor={getBackgroundColor()}
                />
            );
        }
        if (displayAllActors) {
            return (
                <MultipleAvatars
                    icons={[icon, secondaryAvatar]}
                    isInReportAction
                    shouldShowTooltip
                    secondAvatarStyle={[StyleUtils.getBackgroundAndBorderStyle(theme.appBG), isHovered ? StyleUtils.getBackgroundAndBorderStyle(theme.hoverComponentBG) : undefined]}
                />
            );
        }
        return (
            <UserDetailsTooltip
                accountID={Number(delegatePersonalDetails && !isWorkspaceActor ? actorAccountID : (icon.id ?? CONST.DEFAULT_NUMBER_ID))}
                delegateAccountID={action?.delegateAccountID}
                icon={icon}
            >
                <View>
                    <Avatar
                        containerStyles={[styles.actionAvatar]}
                        source={icon.source}
                        type={icon.type}
                        name={icon.name}
                        avatarID={icon.id}
                        fallbackIcon={fallbackIcon}
                    />
                </View>
            </UserDetailsTooltip>
        );
    };

    const hasEmojiStatus = !displayAllActors && status?.emojiCode;
    const formattedDate = DateUtils.getStatusUntilDate(status?.clearAfter ?? '');
    const statusText = status?.text ?? '';
    const statusTooltipText = formattedDate ? `${statusText ? `${statusText} ` : ''}(${formattedDate})` : statusText;

    return (
        <View style={[styles.chatItem, wrapperStyle]}>
            <PressableWithoutFeedback
                style={[styles.alignSelfStart, styles.mr3]}
                onPressIn={ControlSelection.block}
                onPressOut={ControlSelection.unblock}
                onPress={showActorDetails}
                disabled={shouldDisableDetailPage}
                accessibilityLabel={actorHint}
                role={CONST.ROLE.BUTTON}
            >
                <OfflineWithFeedback pendingAction={pendingFields?.avatar ?? undefined}>{getAvatar()}</OfflineWithFeedback>
            </PressableWithoutFeedback>
            <View style={[styles.chatItemRight]}>
                {showHeader ? (
                    <View style={[styles.chatItemMessageHeader]}>
                        <PressableWithoutFeedback
                            style={[styles.flexShrink1, styles.mr1]}
                            onPressIn={ControlSelection.block}
                            onPressOut={ControlSelection.unblock}
                            onPress={showActorDetails}
                            disabled={shouldDisableDetailPage}
                            accessibilityLabel={actorHint}
                            role={CONST.ROLE.BUTTON}
                        >
                            {personArray?.map((fragment, index) => (
                                <ReportActionItemFragment
                                    // eslint-disable-next-line react/no-array-index-key
                                    key={`person-${action?.reportActionID}-${index}`}
                                    accountID={Number(delegatePersonalDetails && !isWorkspaceActor ? actorAccountID : (icon.id ?? CONST.DEFAULT_NUMBER_ID))}
                                    fragment={{...fragment, type: fragment.type ?? '', text: fragment.text ?? ''}}
                                    delegateAccountID={action?.delegateAccountID}
                                    isSingleLine
                                    actorIcon={icon}
                                    moderationDecision={getReportActionMessage(action)?.moderationDecision?.decision}
                                    shouldShowTooltip={!showMultipleUserAvatarPattern}
                                />
                            ))}
                        </PressableWithoutFeedback>
                        {!!hasEmojiStatus && (
                            <Tooltip text={statusTooltipText}>
                                <Text
                                    style={styles.userReportStatusEmoji}
                                    numberOfLines={1}
                                >{`${status?.emojiCode}`}</Text>
                            </Tooltip>
                        )}
                        <ReportActionItemDate created={action?.created ?? ''} />
                    </View>
                ) : null}
                {!!action?.delegateAccountID && (
                    <Text style={[styles.chatDelegateMessage]}>{translate('delegate.onBehalfOfMessage', {delegator: accountOwnerDetails?.displayName ?? ''})}</Text>
                )}
                <View style={hasBeenFlagged ? styles.blockquote : {}}>{children}</View>
            </View>
        </View>
    );
}

ReportActionItemSingle.displayName = 'ReportActionItemSingle';

export default ReportActionItemSingle;
